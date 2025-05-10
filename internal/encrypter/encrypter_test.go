package encrypter

import (
	"fmt"
	"testing"

	"github.com/denisbrodbeck/machineid"
	"github.com/stretchr/testify/assert"
)

func TestEncrypter(t *testing.T) {
	t.Run("should be a noop encrypter in case of error", func(t *testing.T) {
		getMachineID = func() (string, error) {
			return "", fmt.Errorf("error")
		}

		e := New()

		encrypted, err := e.Encrypt("test")

		assert.NoError(t, err)
		assert.Equal(t, "test", encrypted)

		decrypted, err := e.Decrypt("test")

		assert.NoError(t, err)
		assert.Equal(t, "test", decrypted)
	})

	t.Run("should encrypt and decrypt a secret", func(t *testing.T) {
		getMachineID = machineid.ID

		e := New()

		encrypted, err := e.Encrypt("this-is-a-secret-value")

		assert.NoError(t, err)
		assert.NotContains(t, encrypted, "test")

		decrypted, err := e.Decrypt(encrypted)

		assert.NoError(t, err)
		assert.Equal(t, "this-is-a-secret-value", decrypted)
	})

	t.Run("should return just the first 3 chars and rest obfuscated", func(t *testing.T) {
		getMachineID = machineid.ID

		e := New()

		secret := "this-is-a-secret-value"

		encrypted, err := e.Encrypt(secret)

		assert.NoError(t, err)
		assert.NotContains(t, encrypted, "test")

		decrypted, err := e.DecryptSecret(encrypted)

		assert.NoError(t, err)
		assert.Equal(t, "thi*******************", decrypted)
		assert.Len(t, decrypted, len(secret))
	})
}
