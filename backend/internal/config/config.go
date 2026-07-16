package config

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	AppPort string
	AppEnv  string

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	JWTSecret       string
	JWTExpiresHours int

	SeedAdminEmail    string
	SeedAdminPassword string
}

func Load() Config {
	if err := godotenv.Load(); err != nil {
		log.Println(".env file not found, reading configuration from environment variables")
	}

	appPort := mustGetEnv("APP_PORT")
	appEnv := mustGetEnv("APP_ENV")

	dbHost := mustGetEnv("DB_HOST")
	dbPort := mustGetEnv("DB_PORT")
	dbUser := mustGetEnv("DB_USER")
	dbPassword := getEnv("DB_PASSWORD")
	dbName := mustGetEnv("DB_NAME")
	dbSSLMode := mustGetEnv("DB_SSLMODE")

	jwtSecret := mustGetEnv("JWT_SECRET")
	jwtExpiresHours := mustGetEnvAsInt("JWT_EXPIRES_HOURS")

	seedAdminEmail := mustGetEnv("SEED_ADMIN_EMAIL")
	seedAdminPassword := mustGetEnv("SEED_ADMIN_PASSWORD")

	return Config{
		AppPort: appPort,
		AppEnv:  appEnv,

		DBHost:     dbHost,
		DBPort:     dbPort,
		DBUser:     dbUser,
		DBPassword: dbPassword,
		DBName:     dbName,
		DBSSLMode:  dbSSLMode,

		JWTSecret:       jwtSecret,
		JWTExpiresHours: jwtExpiresHours,

		SeedAdminEmail:    seedAdminEmail,
		SeedAdminPassword: seedAdminPassword,
	}
}

func (c Config) DatabaseDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost,
		c.DBPort,
		c.DBUser,
		c.DBPassword,
		c.DBName,
		c.DBSSLMode,
	)
}

func getEnv(key string) string {
	return os.Getenv(key)
}

func mustGetEnv(key string) string {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		log.Fatalf("%s is required", key)
	}
	return value
}

func mustGetEnvAsInt(key string) int {
	value := mustGetEnv(key)
	parsed, err := strconv.Atoi(value)
	if err != nil {
		log.Fatalf("%s must be a valid integer", key)
	}

	return parsed
}
