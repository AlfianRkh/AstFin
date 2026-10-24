package utils

import (
	"fmt"
	"strings"
)

func FormatRupiah(amount float64) string {
	intPart := int64(amount)
	sign := ""
	if intPart < 0 {
		sign = "-"
		intPart = -intPart
	}

	str := fmt.Sprintf("%d", intPart)
	n := len(str)
	if n <= 3 {
		return sign + str
	}

	var sb strings.Builder
	sb.WriteString(sign)
	rem := n % 3
	if rem > 0 {
		sb.WriteString(str[:rem])
		if rem < n {
			sb.WriteString(".")
		}
	}
	for i := rem; i < n; i += 3 {
		sb.WriteString(str[i : i+3])
		if i+3 < n {
			sb.WriteString(".")
		}
	}
	return sb.String()
}
