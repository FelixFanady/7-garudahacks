package seeder

import (
	"sigap-jalan-backend/internal/config"
	"sigap-jalan-backend/internal/models"
	"sigap-jalan-backend/internal/utils"

	"gorm.io/gorm"
)

func SeedAdmin(db *gorm.DB, cfg config.Config) error {
	// 1. Seed Admin
	var adminCount int64
	db.Model(&models.User{}).Where("email = ?", cfg.SeedAdminEmail).Count(&adminCount)
	if adminCount == 0 {
		hashedPassword, err := utils.HashPassword(cfg.SeedAdminPassword)
		if err == nil {
			admin := models.User{
				Email:    cfg.SeedAdminEmail,
				Password: hashedPassword,
				Role:     models.RoleAdmin,
			}
			db.Create(&admin)
		}
	}

	// 2. Seed Support (if not exists)
	var supportCount int64
	db.Model(&models.User{}).Where("email = ?", "support@sigapjalan.id").Count(&supportCount)
	if supportCount == 0 {
		hashedPassword, err := utils.HashPassword("password123")
		if err == nil {
			supportUser := models.User{
				Email:    "support@sigapjalan.id",
				Password: hashedPassword,
				Role:     models.RoleSupport,
			}
			db.Create(&supportUser)
		}
	}

	// 3. Seed ME Staff (if not exists)
	meEmails := []string{"me1@sigapjalan.id", "me2@sigapjalan.id", "me3@sigapjalan.id"}
	for _, email := range meEmails {
		var meCount int64
		db.Model(&models.User{}).Where("email = ?", email).Count(&meCount)
		if meCount == 0 {
			hashedPassword, err := utils.HashPassword("password123")
			if err == nil {
				meUser := models.User{
					Email:    email,
					Password: hashedPassword,
					Role:     models.RoleME,
				}
				db.Create(&meUser)
			}
		}
	}

	return nil
}
