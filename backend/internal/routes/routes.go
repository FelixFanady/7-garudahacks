package routes

import (
	"sigap-jalan-backend/internal/config"
	"sigap-jalan-backend/internal/controllers"
	"sigap-jalan-backend/internal/middleware"
	"sigap-jalan-backend/internal/models"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func Setup(db *gorm.DB, cfg config.Config) *gin.Engine {
	router := gin.Default()

	// Setup CORS middleware
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = []string{
		"http://localhost:5173",
		"http://localhost:3000",
		"http://127.0.0.1:5173",
		"http://127.0.0.1:3000",
	}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
	router.Use(cors.New(corsConfig))

	authController := controllers.NewAuthController(db, cfg)
	adminController := controllers.NewAdminController(db)
	reportController := controllers.NewReportController(db, cfg)

	// Public Routes
	router.POST("/login", authController.Login)
	router.POST("/lapor", reportController.CreateCitizenReport)
	router.POST("/system/lapor", reportController.CreateSystemReportPath)
	router.GET("/public/reports", reportController.ListPublicReports)
	router.GET("/public/reports/:id", reportController.GetPublicReportDetails)

	// Admin Only Routes
	admin := router.Group("/admin")
	admin.Use(middleware.AdminOnly(db, cfg))
	admin.POST("/create-user", adminController.CreateUser)
	admin.GET("/users", adminController.ListUsers)
	admin.PUT("/users/:id/ban", adminController.ToggleBanUser)
	admin.PUT("/users/:id/change-password", adminController.ChangeUserPassword)
	admin.DELETE("/users/:id", adminController.DeleteUser)

	// General Authenticated Routes (Admin, Support, ME)
	authGroup := router.Group("")
	authGroup.Use(middleware.AuthRequired(db, cfg))
	{
		authGroup.GET("/reports/:id", reportController.GetReportDetails)
		authGroup.POST("/reports/:id/comments", reportController.AddReportComment)
		authGroup.PUT("/reports/:id/comments/:comment_id/final-proof", reportController.SetCommentFinalProof)

		// Support Only Group
		supportGroup := authGroup.Group("/support")
		supportGroup.Use(middleware.RoleRequired(models.RoleSupport, models.RoleAdmin))
		{
			supportGroup.GET("/reports", reportController.ListAllReports)
			supportGroup.PUT("/reports/:id/schedule", reportController.ScheduleReport)
			supportGroup.PUT("/reports/:id/false-report", reportController.ToggleFalseReport)
			supportGroup.GET("/me-staff", reportController.ListMESkills)
		}

		// ME Only Group
		meGroup := authGroup.Group("/me")
		meGroup.Use(middleware.RoleRequired(models.RoleME))
		{
			meGroup.GET("/reports", reportController.ListMyTasks)
			meGroup.PUT("/reports/:id/status", reportController.UpdateTaskStatus)
		}
	}

	return router
}
