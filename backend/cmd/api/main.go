package main

import (
	"log"

	"sigap-jalan-backend/internal/config"
	"sigap-jalan-backend/internal/database"
	"sigap-jalan-backend/internal/routes"
	"sigap-jalan-backend/internal/seeder"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	// Drop reports/comments tables ONLY if migrating to the new UID schema
	if db.Migrator().HasTable("reports") && !db.Migrator().HasColumn("reports", "uid") {
		log.Println("Migrating to new UID schema: dropping old reports and comments tables...")
		db.Migrator().DropTable("comments")
		db.Migrator().DropTable("reports")
	}

	if err := database.AutoMigrate(db); err != nil {
		log.Fatalf("failed to run database migration: %v", err)
	}

	if err := seeder.SeedReports(db); err != nil {
		log.Fatalf("failed to seed reports: %v", err)
	}

	router := routes.Setup(db, cfg)

	if err := router.Run(":" + cfg.AppPort); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
