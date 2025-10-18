import dotenv from "dotenv"


export const config = {
    env: "development",
    PORT: "",
    GRPC_PORT: "",
    Database: {
        DB_HOST: "",
        DB_PORT: "",
        DB_USERNAME: "",
        DB_PASSWORD: "",
        DB_NAME: ""
    },
    REDIS: {
        REDIS_HOST: "",
        REDIS_PORT: ""
    },
    KAFKA: {
        host: "",
        port: ""
    },
    SMTP: {
        SMTP_HOST: "smtp.gmail.com",
        SMTP_PORT: 587,
        SMTP_USER: "your - email@gmail.com",
        SMTP_PASS: "your - app - password",
        SMTP_FROM: "noreply@notification.com",
    },
    MQTT: {
        MQTT_BROKER: "mqtt://localhost:1883",
        MQTT_CLIENT_ID: "notification - service"
    },
    FIREBASE: {

    }
}


// # This was inserted by `prisma init`:
// # Environment variables declared in this file are automatically made available to Prisma.
// # See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

// # Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
// # See the documentation for all the connection string options: https://pris.ly/d/connection-strings

// # The following `prisma+postgres` URL is similar to the URL produced by running a local Prisma Postgres 
// # server with the`prisma dev` CLI command, when not choosing any non -default ports or settings.The API key, unlike the 
// # one found in a remote Prisma Postgres URL, does not contain any sensitive information.

//     DATABASE_URL = "prisma+postgres://localhost:51213/?api_key=eyJkYXRhYmFzZVVybCI6InBvc3RncmVzOi8vcG9zdGdyZXM6cG9zdGdyZXNAbG9jYWxob3N0OjUxMjE0L3RlbXBsYXRlMT9zc2xtb2RlPWRpc2FibGUmY29ubmVjdGlvbl9saW1pdD0xJmNvbm5lY3RfdGltZW91dD0wJm1heF9pZGxlX2Nvbm5lY3Rpb25fbGlmZXRpbWU9MCZwb29sX3RpbWVvdXQ9MCZzaW5nbGVfdXNlX2Nvbm5lY3Rpb25zPXRydWUmc29ja2V0X3RpbWVvdXQ9MCIsIm5hbWUiOiJkZWZhdWx0Iiwic2hhZG93RGF0YWJhc2VVcmwiOiJwb3N0Z3JlczovL3Bvc3RncmVzOnBvc3RncmVzQGxvY2FsaG9zdDo1MTIxNS90ZW1wbGF0ZTE_c3NsbW9kZT1kaXNhYmxlJmNvbm5lY3Rpb25fbGltaXQ9MSZjb25uZWN0X3RpbWVvdXQ9MCZtYXhfaWRsZV9jb25uZWN0aW9uX2xpZmV0aW1lPTAmcG9vbF90aW1lb3V0PTAmc2luZ2xlX3VzZV9jb25uZWN0aW9ucz10cnVlJnNvY2tldF90aW1lb3V0PTAifQ"