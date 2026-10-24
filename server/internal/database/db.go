package database

import (
	"database/sql"
	"fmt"
	"strings"
)

type DB struct {
	*sql.DB
	Driver string
}

type Tx struct {
	*sql.Tx
	Driver string
}

func NewDB(db *sql.DB, driver string) *DB {
	return &DB{
		DB:     db,
		Driver: driver,
	}
}

func (d *DB) Rebind(query string) string {
	if d.Driver != "postgres" {
		return query
	}
	return rebindToDollar(query)
}

func (t *Tx) Rebind(query string) string {
	if t.Driver != "postgres" {
		return query
	}
	return rebindToDollar(query)
}

func rebindToDollar(query string) string {
	var b strings.Builder
	param := 1
	inString := false

	for i := 0; i < len(query); i++ {
		char := query[i]
		if char == '\'' {
			inString = !inString
			b.WriteByte(char)
		} else if char == '?' && !inString {
			fmt.Fprintf(&b, "$%d", param)
			param++
		} else {
			b.WriteByte(char)
		}
	}
	return b.String()
}

func (d *DB) Query(query string, args ...interface{}) (*sql.Rows, error) {
	return d.DB.Query(d.Rebind(query), args...)
}

func (d *DB) QueryRow(query string, args ...interface{}) *sql.Row {
	return d.DB.QueryRow(d.Rebind(query), args...)
}

func (d *DB) Exec(query string, args ...interface{}) (sql.Result, error) {
	return d.DB.Exec(d.Rebind(query), args...)
}

func (d *DB) Insert(query string, args ...interface{}) (int64, error) {
	if d.Driver == "postgres" {
		q := d.Rebind(query) + " RETURNING id"
		var id int64
		err := d.DB.QueryRow(q, args...).Scan(&id)
		return id, err
	}
	res, err := d.DB.Exec(query, args...)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (d *DB) Begin() (*Tx, error) {
	tx, err := d.DB.Begin()
	if err != nil {
		return nil, err
	}
	return &Tx{Tx: tx, Driver: d.Driver}, nil
}

func (t *Tx) Query(query string, args ...interface{}) (*sql.Rows, error) {
	return t.Tx.Query(t.Rebind(query), args...)
}

func (t *Tx) QueryRow(query string, args ...interface{}) *sql.Row {
	return t.Tx.QueryRow(t.Rebind(query), args...)
}

func (t *Tx) Exec(query string, args ...interface{}) (sql.Result, error) {
	return t.Tx.Exec(t.Rebind(query), args...)
}

func (t *Tx) Insert(query string, args ...interface{}) (int64, error) {
	if t.Driver == "postgres" {
		q := t.Rebind(query) + " RETURNING id"
		var id int64
		err := t.Tx.QueryRow(q, args...).Scan(&id)
		return id, err
	}
	res, err := t.Tx.Exec(query, args...)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}
