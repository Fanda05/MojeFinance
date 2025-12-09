CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_providers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(20) NOT NULL,
    config JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES bank_providers(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_bank_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES bank_providers(id) ON DELETE CASCADE,
    external_account_id VARCHAR(100) NOT NULL,
    alias VARCHAR(150),
    currency CHAR(3) NOT NULL DEFAULT 'CZK',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES user_bank_accounts(id) ON DELETE CASCADE,
    occurred_at TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    currency CHAR(3) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    source VARCHAR(50) DEFAULT 'manual',
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO bank_providers (code, name, provider_type, config)
VALUES
    ('ceska_sporitelna', 'Česká spořitelna', 'real', '{}'),
    ('csob', 'ČSOB', 'real', '{}'),
    ('kb', 'Komerční banka', 'real', '{}'),
    ('mock_a', 'Mock Banka 1', 'mock', '{}'),
    ('mock_b', 'Mock Banka 2', 'mock', '{}')
ON CONFLICT (code) DO NOTHING;
