package middleware

import (
	"net/http"
	"strings"

	"sigap-jalan-backend/internal/config"
	"sigap-jalan-backend/internal/models"
	"sigap-jalan-backend/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func AdminOnly(db *gorm.DB, cfg config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization header is required"})
			return
		}

		tokenString, ok := strings.CutPrefix(authHeader, "Bearer ")
		if !ok || strings.TrimSpace(tokenString) == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization header must use Bearer token"})
			return
		}

		claims, err := utils.ValidateJWT(strings.TrimSpace(tokenString), cfg)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		var user models.User
		if err := db.First(&user, claims.UserID).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			return
		}

		if user.Role != models.RoleAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin role is required"})
			return
		}

		c.Set("authUser", user)
		c.Next()
	}
}
