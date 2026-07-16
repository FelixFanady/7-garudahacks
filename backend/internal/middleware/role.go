package middleware

import (
	"net/http"

	"sigap-jalan-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func RoleRequired(allowedRoles ...models.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		authUserVal, exists := c.Get("authUser")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		user := authUserVal.(models.User)

		for _, role := range allowedRoles {
			if user.Role == role {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "hak akses tidak diizinkan untuk peran Anda"})
	}
}
