"""SQLite database setup with seed data for wonder-wow-wall."""

import sqlite3
import os
import json
import uuid
from datetime import datetime, timedelta
from app.seed_data import SEED_CATEGORIES, SEED_DESIGNS

DB_PATH = os.path.join(os.path.dirname(__file__), "wow_wall.db")

def get_password_hash(password: str) -> str:
    """Simple bcrypt-style hash for development."""
    import hashlib
    salt = "wow-wall-salt"
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()

def create_tables(conn):
    """Create all tables based on Alembic migrations."""
    cursor = conn.cursor()

    # 001 - Initial schema
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(36) PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(50) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

        CREATE TABLE IF NOT EXISTS user_addresses (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            label VARCHAR(100) DEFAULT '',
            city VARCHAR(100) DEFAULT '',
            street VARCHAR(255) DEFAULT '',
            building VARCHAR(50) DEFAULT '',
            apartment VARCHAR(50) DEFAULT '',
            postal_code VARCHAR(20) DEFAULT '',
            is_default BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);

        CREATE TABLE IF NOT EXISTS categories (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(100) UNIQUE NOT NULL,
            image VARCHAR(500) DEFAULT '',
            count INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

        CREATE TABLE IF NOT EXISTS designs (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) UNIQUE NOT NULL,
            category_id VARCHAR(36) NOT NULL,
            style VARCHAR(100) DEFAULT '',
            image VARCHAR(500) DEFAULT '',
            description TEXT DEFAULT '',
            price INTEGER DEFAULT 1200,
            colors TEXT DEFAULT '[]',
            rating REAL DEFAULT 0.0,
            reviews_count INTEGER DEFAULT 0,
            is_new BOOLEAN DEFAULT 0,
            is_popular BOOLEAN DEFAULT 0,
            is_published BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        );
        CREATE INDEX IF NOT EXISTS idx_designs_slug ON designs(slug);
        CREATE INDEX IF NOT EXISTS idx_designs_category_id ON designs(category_id);

        CREATE TABLE IF NOT EXISTS design_reviews (
            id VARCHAR(36) PRIMARY KEY,
            design_id VARCHAR(36) NOT NULL,
            user_id VARCHAR(36) NOT NULL,
            user_name VARCHAR(255) DEFAULT '',
            rating INTEGER NOT NULL,
            text TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_design_reviews_design_id ON design_reviews(design_id);

        CREATE TABLE IF NOT EXISTS orders (
            id VARCHAR(36) PRIMARY KEY,
            number VARCHAR(50) UNIQUE NOT NULL,
            user_id VARCHAR(36) NOT NULL,
            status VARCHAR(20) DEFAULT 'placed',
            address TEXT DEFAULT '',
            total INTEGER DEFAULT 0,
            notes TEXT DEFAULT '',
            cancel_reason TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
        CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

        CREATE TABLE IF NOT EXISTS order_items (
            id VARCHAR(36) PRIMARY KEY,
            order_id VARCHAR(36) NOT NULL,
            design_id VARCHAR(36) DEFAULT '',
            design_name VARCHAR(255) DEFAULT '',
            design_image VARCHAR(500) DEFAULT '',
            size_key VARCHAR(20) DEFAULT '',
            color VARCHAR(100) DEFAULT '',
            quantity INTEGER DEFAULT 1,
            unit_price INTEGER DEFAULT 0,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS subscriptions (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            plan_id VARCHAR(20) NOT NULL,
            status VARCHAR(20) DEFAULT 'active',
            area_used_this_month_m2 REAL DEFAULT 0.0,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);

        CREATE TABLE IF NOT EXISTS projects (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            name VARCHAR(255) NOT NULL,
            wall_cols INTEGER DEFAULT 5,
            wall_rows INTEGER DEFAULT 3,
            wall_color VARCHAR(20) DEFAULT '#ffffff',
            panels TEXT DEFAULT '[]',
            total_price INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    """)

    # 002 - Add installation_date
    cursor.executescript("""
        ALTER TABLE subscriptions ADD COLUMN installation_date TIMESTAMP;
    """)

    # 003 - Subscription area model
    cursor.executescript("""
        ALTER TABLE subscriptions ADD COLUMN area_limit_m2 REAL DEFAULT 0.0;
    """)

    # 004 - Visualization projects
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS visualization_projects (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            name VARCHAR(255) NOT NULL,
            wall_photo_path VARCHAR(500) DEFAULT '',
            wall_mask_path VARCHAR(500) DEFAULT '',
            scene_data TEXT DEFAULT '{}',
            status VARCHAR(20) DEFAULT 'draft',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_visualization_projects_user_id ON visualization_projects(user_id);
        CREATE INDEX IF NOT EXISTS idx_visualization_projects_status ON visualization_projects(status);
    """)

    # 005 - Add perspective_calibration
    cursor.executescript("""
        ALTER TABLE visualization_projects ADD COLUMN perspective_calibration TEXT DEFAULT '{}';
    """)

    # 006 - Add role to users
    cursor.executescript("""
        ALTER TABLE users ADD COLUMN role VARCHAR(16) DEFAULT 'CUSTOMER';
        ALTER TABLE users ADD COLUMN is_blocked BOOLEAN DEFAULT 0;
    """)

    # 008 - Add order notes and cancel reason
    cursor.executescript("""
        -- Already added in 001 as notes and cancel_reason
    """)

    # 010 - Media assets
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS media_assets (
            id VARCHAR(36) PRIMARY KEY,
            path VARCHAR(500) NOT NULL,
            mime VARCHAR(100) NOT NULL,
            size_bytes INTEGER NOT NULL,
            original_name VARCHAR(255) NOT NULL DEFAULT '',
            uploaded_by VARCHAR(36) NOT NULL,
            purpose VARCHAR(32) NOT NULL,
            uploaded_at TIMESTAMP NOT NULL,
            UNIQUE(path)
        );
        CREATE INDEX IF NOT EXISTS idx_media_assets_path ON media_assets(path);
        CREATE INDEX IF NOT EXISTS idx_media_assets_purpose ON media_assets(purpose);
    """)

    # 011 - Panels
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS panels (
            id VARCHAR(36) PRIMARY KEY,
            sku VARCHAR(100) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            size_key VARCHAR(20) NOT NULL,
            price INTEGER NOT NULL,
            stock INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_panels_sku ON panels(sku);
    """)

    # 012 - Shop settings
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS shop_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            flat_delivery_price INTEGER DEFAULT 500,
            free_delivery_threshold INTEGER DEFAULT 5000,
            installation_price_per_m2 INTEGER DEFAULT 1000,
            currency VARCHAR(10) DEFAULT 'RUB',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 013 - Audit entries
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS audit_entries (
            id VARCHAR(36) PRIMARY KEY,
            actor_id VARCHAR(36),
            action VARCHAR(50) NOT NULL,
            target_type VARCHAR(50),
            target_id VARCHAR(36),
            details TEXT DEFAULT '{}',
            ip VARCHAR(45),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_audit_entries_created_at ON audit_entries(created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_entries_actor_id ON audit_entries(actor_id);
    """)

    # 014 - Recommendations
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS recommendations (
            id VARCHAR(36) PRIMARY KEY,
            design_id VARCHAR(36) NOT NULL,
            recommended_design_id VARCHAR(36) NOT NULL,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE,
            FOREIGN KEY (recommended_design_id) REFERENCES designs(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_recommendations_design_id ON recommendations(design_id);
    """)

    # 016 - Banners
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS banners (
            id VARCHAR(36) PRIMARY KEY,
            image_url VARCHAR(500) NOT NULL,
            link VARCHAR(500) DEFAULT '',
            title VARCHAR(255) DEFAULT '',
            is_active BOOLEAN DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_banners_is_active ON banners(is_active);
    """)

    # 017 - Subscription plans
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS subscription_plans (
            id VARCHAR(20) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            price INTEGER NOT NULL,
            period VARCHAR(20) NOT NULL,
            area_limit_m2 REAL NOT NULL,
            popular BOOLEAN DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            features TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON subscription_plans(is_active);
    """)

    conn.commit()
    print("Tables created successfully")


def seed_data(conn):
    """Seed categories, designs, admin user, and subscription plans."""
    cursor = conn.cursor()

    # Seed categories
    for cat in SEED_CATEGORIES:
        cursor.execute("""
            INSERT OR REPLACE INTO categories (id, name, slug, image, count)
            VALUES (?, ?, ?, ?, ?)
        """, (cat.id, cat.name, cat.slug, cat.image, cat.count))

    # Seed designs
    for d in SEED_DESIGNS:
        colors_json = json.dumps([{"hex": c.hex, "name": c.name} for c in d.colors])
        is_new = 1 if d.is_new else 0
        is_popular = 1 if d.is_popular else 0
        cursor.execute("""
            INSERT OR REPLACE INTO designs
            (id, name, slug, category_id, style, image, description, price, colors, rating, reviews_count, is_new, is_popular)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (d.id, d.name, d.slug, d.category_id, d.style, d.image, d.description, d.price, colors_json, d.rating, d.reviews_count, is_new, is_popular))

    # Seed admin user
    admin_id = "admin-root"
    admin_hash = get_password_hash("admin123")
    now = datetime.now().isoformat()
    cursor.execute("""
        INSERT OR REPLACE INTO users (id, email, password_hash, name, phone, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (admin_id, "admin@wow.ru", admin_hash, "Admin", "+79001234567", "ADMIN", now))

    # Seed subscription plans
    plans = [
        ("plan-basic", "Базовый", 990, "месяц", 2.0, 0, 1, 0, '["Обновление 1 накладки","Каталог дизайнов","Конструктор"]'),
        ("plan-comfort", "Комфорт", 1990, "месяц", 5.0, 1, 2, 1, '["Обновление до 5 накладок","Каталог дизайнов","Конструктор","Фото-редактор"]'),
        ("plan-premium", "Премиум", 3990, "месяц", 10.0, 1, 3, 2, '["Обновление до 10 накладок","Каталог дизайнов","Конструктор","Фото-редактор","Приоритетная поддержка"]'),
    ]
    for p in plans:
        cursor.execute("""
            INSERT OR REPLACE INTO subscription_plans
            (id, name, price, period, area_limit_m2, popular, is_active, sort_order, features)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, p)

    # Seed shop settings
    cursor.execute("""
        INSERT OR REPLACE INTO shop_settings (id, flat_delivery_price, free_delivery_threshold, installation_price_per_m2)
        VALUES (1, 500, 5000, 1000)
    """)

    # Seed sample customers and orders for demo
    customers = [
        ("c1", "ivan@example.com", "Иван", "+79001001001"),
        ("c2", "petr@example.com", "Пётр", "+79001001002"),
        ("c3", "anna@example.com", "Анна", "+79001001003"),
    ]
    for cid, email, name, phone in customers:
        cursor.execute("""
            INSERT OR REPLACE INTO users (id, email, password_hash, name, phone, role, created_at)
            VALUES (?, ?, ?, ?, ?, 'CUSTOMER', ?)
        """, (cid, email, get_password_hash("password123"), name, phone, now))

    # Sample orders
    order_ids = ["ord-1", "ord-2", "ord-3"]
    for i, oid in enumerate(order_ids):
        cursor.execute("""
            INSERT OR REPLACE INTO orders (id, number, user_id, status, address, total, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (oid, f"WOW-{100+i}", customers[i][0], ["placed", "processing", "delivered"][i],
              "Москва, ул. Пушкина, д. 10", [3600, 7200, 12000][i], now))

    conn.commit()
    print("Data seeded successfully")


def add_indexes(conn):
    """Add additional indexes for performance."""
    cursor = conn.cursor()

    indexes = [
        # Users indexes
        ("idx_users_role", "users", "role"),
        ("idx_users_is_blocked", "users", "is_blocked"),
        ("idx_users_created_at", "users", "created_at"),

        # Designs indexes
        ("idx_designs_is_new", "designs", "is_new"),
        ("idx_designs_is_popular", "designs", "is_popular"),
        ("idx_designs_rating", "designs", "rating"),
        ("idx_designs_price", "designs", "price"),

        # Orders indexes
        ("idx_orders_number", "orders", "number"),

        # Reviews indexes
        ("idx_design_reviews_user_id", "design_reviews", "user_id"),
        ("idx_design_reviews_rating", "design_reviews", "rating"),

        # Subscriptions indexes
        ("idx_subscriptions_status", "subscriptions", "status"),
        ("idx_subscriptions_expires_at", "subscriptions", "expires_at"),

        # Projects indexes
        ("idx_projects_created_at", "projects", "created_at"),

        # Visualization projects indexes
        ("idx_visualization_projects_created_at", "visualization_projects", "created_at"),
    ]

    for idx_name, table, column in indexes:
        try:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({column})")
            print(f"Created index: {idx_name}")
        except Exception as e:
            print(f"Index {idx_name} already exists or error: {e}")

    conn.commit()
    print("Indexes created successfully")


def main():
    """Initialize SQLite database with all tables, seed data, and indexes."""
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"Removed existing database: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    print("Creating tables...")
    create_tables(conn)

    print("Seeding data...")
    seed_data(conn)

    print("Creating indexes...")
    add_indexes(conn)

    conn.close()
    print(f"\nDatabase created successfully at: {DB_PATH}")
    print(f"Size: {os.path.getsize(DB_PATH) / 1024:.1f} KB")

    # Verify
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"\nTables ({len(tables)}): {', '.join(tables)}")

    cursor.execute("SELECT COUNT(*) as cnt FROM users")
    print(f"Users: {cursor.fetchone()[0]}")
    cursor.execute("SELECT COUNT(*) as cnt FROM categories")
    print(f"Categories: {cursor.fetchone()[0]}")
    cursor.execute("SELECT COUNT(*) as cnt FROM designs")
    print(f"Designs: {cursor.fetchone()[0]}")
    conn.close()


if __name__ == "__main__":
    main()