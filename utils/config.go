// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/model/oauth"
)

const (
	MODE_DEV        = "dev"
	MODE_BETA       = "beta"
	MODE_PROD       = "prod"
	LOG_ROTATE_SIZE = 10000
)

type ClientConfig map[string]interface{}

var Cfg *model.Config = &model.Config{}
var CfgDiagnosticId = ""
var CfgLastModified int64 = 0
var CfgFileName string = ""
var ClientCfg ClientConfig = map[string]interface{}{}

func (cfg *ClientConfig) ToJson() string {
	if b, err := json.Marshal(cfg); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func FindConfigFile(fileName string) string {
	if _, err := os.Stat("/tmp/" + fileName); err == nil {
		fileName, _ = filepath.Abs("/tmp/" + fileName)
	} else if _, err := os.Stat("./config/" + fileName); err == nil {
		fileName, _ = filepath.Abs("./config/" + fileName)
	} else if _, err := os.Stat("../config/" + fileName); err == nil {
		fileName, _ = filepath.Abs("../config/" + fileName)
	} else if _, err := os.Stat(fileName); err == nil {
		fileName, _ = filepath.Abs(fileName)
	}

	return fileName
}

func FindDir(dir string) string {
	fileName := "."
	if _, err := os.Stat("./" + dir + "/"); err == nil {
		fileName, _ = filepath.Abs("./" + dir + "/")
	} else if _, err := os.Stat("../" + dir + "/"); err == nil {
		fileName, _ = filepath.Abs("../" + dir + "/")
	} else if _, err := os.Stat("/tmp/" + dir); err == nil {
		fileName, _ = filepath.Abs("/tmp/" + dir)
	}

	return fileName + "/"
}

func ConfigureCmdLineLog() {
	ls := model.LogSettings{}
	ls.EnableConsole = true
	ls.ConsoleLevel = "WARN"
	configureLog(&ls)
}

func configureLog(s *model.LogSettings) {

	l4g.Close()

	if s.EnableConsole {
		level := l4g.DEBUG
		if s.ConsoleLevel == "INFO" {
			level = l4g.INFO
		} else if s.ConsoleLevel == "WARN" {
			level = l4g.WARNING
		} else if s.ConsoleLevel == "ERROR" {
			level = l4g.ERROR
		}

		lw := l4g.NewConsoleLogWriter()
		lw.SetFormat("[%D %T] [%L] %M")
		l4g.AddFilter("stdout", level, lw)
	}

	if s.EnableFile {

		var fileFormat = s.FileFormat

		if fileFormat == "" {
			fileFormat = "[%D %T] [%L] %M"
		}

		level := l4g.DEBUG
		if s.FileLevel == "INFO" {
			level = l4g.INFO
		} else if s.FileLevel == "WARN" {
			level = l4g.WARNING
		} else if s.FileLevel == "ERROR" {
			level = l4g.ERROR
		}

		flw := l4g.NewFileLogWriter(GetLogFileLocation(s.FileLocation), false)
		flw.SetFormat(fileFormat)
		flw.SetRotate(true)
		flw.SetRotateLines(LOG_ROTATE_SIZE)
		l4g.AddFilter("file", level, flw)
	}
}

func GetLogFileLocation(fileLocation string) string {
	if fileLocation == "" {
		return FindDir("logs") + "mattermost.log"
	} else {
		return fileLocation
	}
}

func SaveConfig(fileName string, config *model.Config) *model.AppError {
	b, err := json.MarshalIndent(config, "", "    ")
	if err != nil {
		return model.NewAppError("SaveConfig", "An error occurred while saving the file to "+fileName, err.Error())
	}

	err = ioutil.WriteFile(fileName, b, 0644)
	if err != nil {
		return model.NewAppError("SaveConfig", "An error occurred while saving the file to "+fileName, err.Error())
	}

	return nil
}

func loadOAuthProviders(cfg *model.Config) error {
	if cfg.OAuthConfigDir == "" {
	}
	providers, err := filepath.Glob(filepath.Join(cfg.OAuthConfigDir, "*.json"))
	if err != nil {
		return fmt.Errorf("Error looking for oauth provider files in %s: %s", cfg.OAuthConfigDir, err)
	}
	for _, filePath := range providers {
		providerName, provider, settings, err := oauth.LoadOAuthProviderFromSettings(filePath)
		if err != nil {
			return fmt.Errorf("Error loading oauth provider settings from %s: %s", filePath, err)
		}
		if !settings.Enable {
			continue
		}
		if provider == nil {
			return fmt.Errorf("Internal OAuth provider missing after load from settings")
		}
		if cfg.OAuthSettings == nil {
			cfg.OAuthSettings = make(map[string]*model.SSOSettings)
		}
		cfg.OAuthSettings[providerName] = settings
		einterfaces.RegisterOauthProvider(providerName, provider)
	}

	return nil
}

// LoadConfig will try to search around for the corresponding config file.
// It will search /tmp/fileName then attempt ./config/fileName,
// then ../config/fileName and last it will look at fileName
func LoadConfig(fileName string) {

	fileName = FindConfigFile(fileName)

	file, err := os.Open(fileName)
	if err != nil {
		panic("Error opening config file=" + fileName + ", err=" + err.Error())
	}

	decoder := json.NewDecoder(file)
	config := model.Config{}
	err = decoder.Decode(&config)
	if err != nil {
		panic("Error decoding config file=" + fileName + ", err=" + err.Error())
	}

	if info, err := file.Stat(); err != nil {
		panic("Error getting config info file=" + fileName + ", err=" + err.Error())
	} else {
		CfgLastModified = info.ModTime().Unix()
		CfgFileName = fileName
	}

	config.SetDefaults()

	if err := config.IsValid(); err != nil {
		panic("Error validating config file=" + fileName + ", err=" + err.Message)
	}

	if err := loadOAuthProviders(&config); err != nil {
		l4g.Info("Error loading oauth providers: " + err.Error())
	}

	configureLog(&config.LogSettings)
	TestConnection(&config)

	if config.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		dir := config.FileSettings.Directory
		if len(dir) > 0 && dir[len(dir)-1:] != "/" {
			config.FileSettings.Directory += "/"
		}
	}

	Cfg = &config
	ClientCfg = getClientConfig(Cfg)
}

func getClientConfig(c *model.Config) map[string]interface{} {
	props := make(map[string]interface{})

	props["Version"] = model.CurrentVersion
	props["BuildNumber"] = model.BuildNumber
	props["BuildDate"] = model.BuildDate
	props["BuildHash"] = model.BuildHash
	props["BuildEnterpriseReady"] = model.BuildEnterpriseReady

	props["SiteName"] = c.TeamSettings.SiteName
	props["EnableTeamCreation"] = strconv.FormatBool(c.TeamSettings.EnableTeamCreation)
	props["EnableUserCreation"] = strconv.FormatBool(c.TeamSettings.EnableUserCreation)
	props["RestrictTeamNames"] = strconv.FormatBool(*c.TeamSettings.RestrictTeamNames)
	props["EnableTeamListing"] = strconv.FormatBool(*c.TeamSettings.EnableTeamListing)

	props["EnableOAuthServiceProvider"] = strconv.FormatBool(c.ServiceSettings.EnableOAuthServiceProvider)

	props["SegmentDeveloperKey"] = c.ServiceSettings.SegmentDeveloperKey
	props["GoogleDeveloperKey"] = c.ServiceSettings.GoogleDeveloperKey
	props["EnableIncomingWebhooks"] = strconv.FormatBool(c.ServiceSettings.EnableIncomingWebhooks)
	props["EnableOutgoingWebhooks"] = strconv.FormatBool(c.ServiceSettings.EnableOutgoingWebhooks)
	props["EnablePostUsernameOverride"] = strconv.FormatBool(c.ServiceSettings.EnablePostUsernameOverride)
	props["EnablePostIconOverride"] = strconv.FormatBool(c.ServiceSettings.EnablePostIconOverride)
	props["EnableDeveloper"] = strconv.FormatBool(*c.ServiceSettings.EnableDeveloper)

	props["SendEmailNotifications"] = strconv.FormatBool(c.EmailSettings.SendEmailNotifications)
	props["EnableSignUpWithEmail"] = strconv.FormatBool(c.EmailSettings.EnableSignUpWithEmail)
	props["RequireEmailVerification"] = strconv.FormatBool(c.EmailSettings.RequireEmailVerification)
	props["FeedbackEmail"] = c.EmailSettings.FeedbackEmail

	props["EnableSignUpWithGitLab"] = strconv.FormatBool(c.GitLabSettings.Enable)
	props["EnableSignUpWithGoogle"] = strconv.FormatBool(c.GoogleSettings.Enable)

	if c.OAuthSettings != nil {
		props["EnableSignUpWithOAuth"] = strconv.FormatBool(true)

		var providerNames []string
		for providerName, _ := range c.OAuthSettings {
			provider := einterfaces.GetOauthProvider(providerName)
			if provider == nil {
				continue
			}
			customOAuthProvider := provider.(*oauth.OAuthProvider)
			providerNames = append(providerNames, customOAuthProvider.DisplayName)
		}
		props["OAuthProviderDisplayNames"] = providerNames
	} else {
		props["EnableSignUpWithOAuth"] = strconv.FormatBool(false)
	}

	props["ShowEmailAddress"] = strconv.FormatBool(c.PrivacySettings.ShowEmailAddress)

	props["TermsOfServiceLink"] = *c.SupportSettings.TermsOfServiceLink
	props["PrivacyPolicyLink"] = *c.SupportSettings.PrivacyPolicyLink
	props["AboutLink"] = *c.SupportSettings.AboutLink
	props["HelpLink"] = *c.SupportSettings.HelpLink
	props["ReportAProblemLink"] = *c.SupportSettings.ReportAProblemLink
	props["SupportEmail"] = *c.SupportSettings.SupportEmail

	props["EnablePublicLink"] = strconv.FormatBool(c.FileSettings.EnablePublicLink)
	props["ProfileHeight"] = fmt.Sprintf("%v", c.FileSettings.ProfileHeight)
	props["ProfileWidth"] = fmt.Sprintf("%v", c.FileSettings.ProfileWidth)

	props["EnableLdap"] = strconv.FormatBool(*c.LdapSettings.Enable)

	return props
}
