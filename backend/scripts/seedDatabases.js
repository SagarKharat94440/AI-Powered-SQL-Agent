import mysql from "mysql2/promise";
import { faker } from "@faker-js/faker";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 5,
    multipleStatements: true,
});

async function seedAll() {
    const conn = await pool.getConnection();
    try {
        console.log("🔧 Connected to MySQL. Starting seed...\n");

        // Create databases
        await conn.query(`CREATE DATABASE IF NOT EXISTS sql_agent_ecommerce`);
        await conn.query(`CREATE DATABASE IF NOT EXISTS sql_agent_hr`);
        await conn.query(`CREATE DATABASE IF NOT EXISTS sql_agent_students`);
        await conn.query(`CREATE DATABASE IF NOT EXISTS sql_agent_uploads`);

        // ═══════════════════════════════
        // ECOMMERCE
        // ═══════════════════════════════
        console.log("📦 Seeding ecommerce...");
        await conn.query(`USE sql_agent_ecommerce`);

        await conn.query(`DROP TABLE IF EXISTS reviews`);
        await conn.query(`DROP TABLE IF EXISTS order_items`);
        await conn.query(`DROP TABLE IF EXISTS orders`);
        await conn.query(`DROP TABLE IF EXISTS products`);
        await conn.query(`DROP TABLE IF EXISTS customers`);
        await conn.query(`DROP TABLE IF EXISTS categories`);

        await conn.query(`
            CREATE TABLE categories (
                category_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT
            )
        `);

        await conn.query(`
            CREATE TABLE customers (
                customer_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                email VARCHAR(200) UNIQUE NOT NULL,
                phone VARCHAR(20),
                city VARCHAR(100),
                country VARCHAR(80),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await conn.query(`
            CREATE TABLE products (
                product_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                stock_quantity INT DEFAULT 0,
                category_id INT,
                rating DECIMAL(2,1) DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(category_id)
            )
        `);

        await conn.query(`
            CREATE TABLE orders (
                order_id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT,
                order_date DATE NOT NULL,
                total_amount DECIMAL(12,2),
                status VARCHAR(30) DEFAULT 'pending',
                shipping_address TEXT,
                FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
            )
        `);

        await conn.query(`
            CREATE TABLE order_items (
                item_id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT,
                product_id INT,
                quantity INT NOT NULL,
                unit_price DECIMAL(10,2) NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(order_id),
                FOREIGN KEY (product_id) REFERENCES products(product_id)
            )
        `);

        await conn.query(`
            CREATE TABLE reviews (
                review_id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT,
                customer_id INT,
                rating INT CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                review_date DATE DEFAULT (CURRENT_DATE),
                FOREIGN KEY (product_id) REFERENCES products(product_id),
                FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
            )
        `);

        // Seed categories
        const categories = ["Electronics", "Clothing", "Home & Kitchen", "Books", "Sports", "Beauty", "Toys", "Automotive"];
        for (const cat of categories) {
            await conn.query(`INSERT INTO categories (name, description) VALUES (?, ?)`, [cat, faker.commerce.productDescription()]);
        }

        // Seed customers (300)
        for (let i = 0; i < 300; i++) {
            await conn.query(
                `INSERT INTO customers (name, email, phone, city, country) VALUES (?, ?, ?, ?, ?)`,
                [faker.person.fullName(), faker.internet.email().toLowerCase() + i, faker.phone.number().substring(0, 20), faker.location.city(), faker.location.country()]
            );
        }

        // Seed products (200)
        for (let i = 0; i < 200; i++) {
            await conn.query(
                `INSERT INTO products (name, price, stock_quantity, category_id, rating) VALUES (?, ?, ?, ?, ?)`,
                [faker.commerce.productName(), parseFloat(faker.commerce.price({ min: 5, max: 2000 })), faker.number.int({ min: 0, max: 500 }), faker.number.int({ min: 1, max: 8 }), (Math.random() * 4 + 1).toFixed(1)]
            );
        }

        // Seed orders (400)
        const statuses = ["pending", "processing", "shipped", "delivered", "cancelled", "returned"];
        for (let i = 0; i < 400; i++) {
            await conn.query(
                `INSERT INTO orders (customer_id, order_date, total_amount, status, shipping_address) VALUES (?, ?, ?, ?, ?)`,
                [faker.number.int({ min: 1, max: 300 }), faker.date.between({ from: "2024-01-01", to: "2025-12-31" }).toISOString().split("T")[0], parseFloat(faker.commerce.price({ min: 10, max: 5000 })), faker.helpers.arrayElement(statuses), faker.location.streetAddress()]
            );
        }

        // Seed order_items (500)
        for (let i = 0; i < 500; i++) {
            const qty = faker.number.int({ min: 1, max: 5 });
            const price = parseFloat(faker.commerce.price({ min: 5, max: 500 }));
            await conn.query(
                `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)`,
                [faker.number.int({ min: 1, max: 400 }), faker.number.int({ min: 1, max: 200 }), qty, price]
            );
        }

        // Seed reviews (300)
        for (let i = 0; i < 300; i++) {
            await conn.query(
                `INSERT INTO reviews (product_id, customer_id, rating, comment, review_date) VALUES (?, ?, ?, ?, ?)`,
                [faker.number.int({ min: 1, max: 200 }), faker.number.int({ min: 1, max: 300 }), faker.number.int({ min: 1, max: 5 }), faker.lorem.sentence(), faker.date.between({ from: "2024-01-01", to: "2025-12-31" }).toISOString().split("T")[0]]
            );
        }
        console.log("  ✅ ecommerce: categories(8), customers(300), products(200), orders(400), order_items(500), reviews(300)");

        // ═══════════════════════════════
        // HR
        // ═══════════════════════════════
        console.log("👥 Seeding hr...");
        await conn.query(`USE sql_agent_hr`);

        await conn.query(`DROP TABLE IF EXISTS \`leaves\``);
        await conn.query(`DROP TABLE IF EXISTS salary`);
        await conn.query(`DROP TABLE IF EXISTS employees`);
        await conn.query(`DROP TABLE IF EXISTS departments`);

        await conn.query(`
            CREATE TABLE departments (
                department_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                location VARCHAR(150),
                budget DECIMAL(15,2),
                manager_name VARCHAR(150)
            )
        `);

        await conn.query(`
            CREATE TABLE employees (
                employee_id INT AUTO_INCREMENT PRIMARY KEY,
                first_name VARCHAR(80) NOT NULL,
                last_name VARCHAR(80) NOT NULL,
                email VARCHAR(200) UNIQUE NOT NULL,
                phone VARCHAR(20),
                hire_date DATE NOT NULL,
                job_title VARCHAR(120),
                department_id INT,
                is_active BOOLEAN DEFAULT true,
                FOREIGN KEY (department_id) REFERENCES departments(department_id)
            )
        `);

        await conn.query(`
            CREATE TABLE salary (
                salary_id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT,
                base_salary DECIMAL(12,2) NOT NULL,
                bonus DECIMAL(10,2) DEFAULT 0,
                pay_date DATE NOT NULL,
                pay_period VARCHAR(20),
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
            )
        `);

        await conn.query(`
            CREATE TABLE \`leaves\` (
                leave_id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT,
                leave_type VARCHAR(30) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                reason TEXT,
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
            )
        `);

        // Seed departments
        const depts = [
            { name: "Engineering", loc: "Building A, Floor 3", budget: 2000000 },
            { name: "Product", loc: "Building A, Floor 2", budget: 800000 },
            { name: "Design", loc: "Building B, Floor 1", budget: 500000 },
            { name: "Marketing", loc: "Building B, Floor 2", budget: 700000 },
            { name: "Sales", loc: "Building C, Floor 1", budget: 1200000 },
            { name: "Human Resources", loc: "Building A, Floor 1", budget: 400000 },
            { name: "Finance", loc: "Building C, Floor 2", budget: 600000 },
            { name: "Operations", loc: "Building D, Floor 1", budget: 900000 },
        ];
        for (const d of depts) {
            await conn.query(`INSERT INTO departments (name, location, budget, manager_name) VALUES (?, ?, ?, ?)`, [d.name, d.loc, d.budget, faker.person.fullName()]);
        }

        // Seed employees (300)
        const jobTitles = ["Software Engineer", "Senior Developer", "Product Manager", "UX Designer", "Data Analyst", "Marketing Specialist", "Sales Rep", "HR Coordinator", "DevOps Engineer", "QA Engineer", "Tech Lead", "Director", "VP", "Intern", "Accountant"];
        for (let i = 0; i < 300; i++) {
            await conn.query(
                `INSERT INTO employees (first_name, last_name, email, phone, hire_date, job_title, department_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [faker.person.firstName(), faker.person.lastName(), faker.internet.email().toLowerCase() + i, faker.phone.number().substring(0, 20), faker.date.between({ from: "2018-01-01", to: "2025-06-01" }).toISOString().split("T")[0], faker.helpers.arrayElement(jobTitles), faker.number.int({ min: 1, max: 8 }), Math.random() > 0.1]
            );
        }

        // Seed salary (500)
        const payPeriods = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        for (let i = 0; i < 500; i++) {
            const base = faker.number.int({ min: 35000, max: 180000 });
            await conn.query(
                `INSERT INTO salary (employee_id, base_salary, bonus, pay_date, pay_period) VALUES (?, ?, ?, ?, ?)`,
                [faker.number.int({ min: 1, max: 300 }), base, faker.number.int({ min: 0, max: 15000 }), faker.date.between({ from: "2024-01-01", to: "2025-12-31" }).toISOString().split("T")[0], faker.helpers.arrayElement(payPeriods)]
            );
        }

        // Seed leaves (250)
        const leaveTypes = ["Sick", "Vacation", "Personal", "Maternity", "Paternity", "Bereavement"];
        const leaveStatuses = ["approved", "pending", "rejected"];
        for (let i = 0; i < 250; i++) {
            const start = faker.date.between({ from: "2024-01-01", to: "2025-12-01" });
            const end = new Date(start);
            end.setDate(end.getDate() + faker.number.int({ min: 1, max: 14 }));
            await conn.query(
                "INSERT INTO `leaves` (employee_id, leave_type, start_date, end_date, status, reason) VALUES (?, ?, ?, ?, ?, ?)",
                [faker.number.int({ min: 1, max: 300 }), faker.helpers.arrayElement(leaveTypes), start.toISOString().split("T")[0], end.toISOString().split("T")[0], faker.helpers.arrayElement(leaveStatuses), faker.lorem.sentence()]
            );
        }
        console.log("  ✅ hr: departments(8), employees(300), salary(500), leaves(250)");

        // ═══════════════════════════════
        // STUDENTS
        // ═══════════════════════════════
        console.log("🎓 Seeding students...");
        await conn.query(`USE sql_agent_students`);

        await conn.query(`DROP TABLE IF EXISTS grades`);
        await conn.query(`DROP TABLE IF EXISTS enrollment`);
        await conn.query(`DROP TABLE IF EXISTS courses`);
        await conn.query(`DROP TABLE IF EXISTS students`);

        await conn.query(`
            CREATE TABLE students (
                student_id INT AUTO_INCREMENT PRIMARY KEY,
                first_name VARCHAR(80) NOT NULL,
                last_name VARCHAR(80) NOT NULL,
                email VARCHAR(200) UNIQUE NOT NULL,
                major VARCHAR(100),
                gpa DECIMAL(3,2),
                enrollment_year INT,
                is_active BOOLEAN DEFAULT true
            )
        `);

        await conn.query(`
            CREATE TABLE courses (
                course_id INT AUTO_INCREMENT PRIMARY KEY,
                course_name VARCHAR(150) NOT NULL,
                course_code VARCHAR(20) UNIQUE NOT NULL,
                credits INT NOT NULL,
                department VARCHAR(100),
                instructor VARCHAR(150)
            )
        `);

        await conn.query(`
            CREATE TABLE enrollment (
                enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT,
                course_id INT,
                semester VARCHAR(20) NOT NULL,
                year INT NOT NULL,
                status VARCHAR(20) DEFAULT 'enrolled',
                FOREIGN KEY (student_id) REFERENCES students(student_id),
                FOREIGN KEY (course_id) REFERENCES courses(course_id)
            )
        `);

        await conn.query(`
            CREATE TABLE grades (
                grade_id INT AUTO_INCREMENT PRIMARY KEY,
                enrollment_id INT,
                grade VARCHAR(5),
                score DECIMAL(5,2),
                graded_date DATE,
                FOREIGN KEY (enrollment_id) REFERENCES enrollment(enrollment_id)
            )
        `);

        // Seed students (300)
        const majors = ["Computer Science", "Mathematics", "Physics", "Chemistry", "Biology", "English Literature", "Business Administration", "Psychology", "Electrical Engineering", "Mechanical Engineering", "History", "Economics"];
        for (let i = 0; i < 300; i++) {
            await conn.query(
                `INSERT INTO students (first_name, last_name, email, major, gpa, enrollment_year, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [faker.person.firstName(), faker.person.lastName(), faker.internet.email().toLowerCase() + i, faker.helpers.arrayElement(majors), (Math.random() * 2 + 2).toFixed(2), faker.number.int({ min: 2020, max: 2025 }), Math.random() > 0.15]
            );
        }

        // Seed courses (50)
        const coursePrefixes = ["CS", "MATH", "PHYS", "CHEM", "BIOL", "ENG", "BUS", "PSY", "EE", "ME", "HIST", "ECON"];
        for (let i = 0; i < 50; i++) {
            const prefix = faker.helpers.arrayElement(coursePrefixes);
            const num = faker.number.int({ min: 100, max: 499 });
            await conn.query(
                `INSERT INTO courses (course_name, course_code, credits, department, instructor) VALUES (?, ?, ?, ?, ?)`,
                [faker.lorem.words(3) + " " + prefix, `${prefix}${num}_${i}`, faker.number.int({ min: 1, max: 4 }), prefix, faker.person.fullName()]
            );
        }

        // Seed enrollment (500)
        const semesters = ["Fall", "Spring", "Summer"];
        const enrollStatuses = ["enrolled", "completed", "dropped", "withdrawn"];
        for (let i = 0; i < 500; i++) {
            await conn.query(
                `INSERT INTO enrollment (student_id, course_id, semester, year, status) VALUES (?, ?, ?, ?, ?)`,
                [faker.number.int({ min: 1, max: 300 }), faker.number.int({ min: 1, max: 50 }), faker.helpers.arrayElement(semesters), faker.number.int({ min: 2022, max: 2025 }), faker.helpers.arrayElement(enrollStatuses)]
            );
        }

        // Seed grades (400)
        const gradeLetters = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"];
        for (let i = 0; i < 400; i++) {
            const grade = faker.helpers.arrayElement(gradeLetters);
            const scoreMap = { "A+": 98, "A": 94, "A-": 91, "B+": 88, "B": 84, "B-": 81, "C+": 78, "C": 74, "C-": 71, "D": 65, "F": 45 };
            const baseScore = scoreMap[grade];
            await conn.query(
                `INSERT INTO grades (enrollment_id, grade, score, graded_date) VALUES (?, ?, ?, ?)`,
                [faker.number.int({ min: 1, max: 500 }), grade, baseScore + Math.random() * 3 - 1, faker.date.between({ from: "2023-01-01", to: "2025-12-31" }).toISOString().split("T")[0]]
            );
        }
        console.log("  ✅ students: students(300), courses(50), enrollment(500), grades(400)");

        console.log("\n🎉 Database seeding complete!");
    } catch (error) {
        console.error("❌ Seeding error:", error.message);
        throw error;
    } finally {
        conn.release();
        await pool.end();
    }
}

seedAll();
