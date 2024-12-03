import dotenv from 'dotenv';
import express, { query } from 'express'
import bodyParser from 'body-parser';
import mysql from 'mysql'
import bcrypt, { hash } from 'bcrypt'
import axios from 'axios';
import cors from 'cors'
import multer from 'multer'

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/img')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
})

const upload = multer({ storage })


// import cors from 'cors';
dotenv.config();

const app = express();
app.use(cors());
const saltRound = 10;
app.use(express.static("public"))


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());



app.post('/api/picture', upload.single('file'), (req, res) => {
    res.json(req.file);
})


const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

connection.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL database.');
});

global.userId = 0;
global.user = 'Guests';

app.get("/login", (req, res) => {
    global.user = 'Guests';
    res.render("../views/login.ejs")
});

app.post("/login", (req, res) => {
    const email = req.body.email;
    const loginPassword = req.body.password;

    try {
        connection.query("SELECT * FROM users WHERE email = ?", [email], (error, results) => {
            if (error) {
                console.error("Database query error:", error);
                return;
            }
            // Check if we got results
            if (results.length > 0) {
                const user = results[0];

                const storedPassword = user.password;
                const role = user.role;
                const name = user.name;
                global.user = name;

                bcrypt.compare(loginPassword, storedPassword, (error, results) => {
                    if (error) {
                        console.log("Error comparing password", error);
                    }
                    else {
                        if (results) {
                            global.userId = user.id;

                            // Redirect based on role
                            if (role == "admin") {
                                return res.redirect("/admin");
                            } else {
                                return res.redirect("/shop");
                            }
                        }
                        else {
                            var error = {
                                errorpassword: "Password is not correct!",
                                erroruser: ""
                            }
                            res.render("../views/login.ejs", { error: error });
                        }
                    }
                });

            }
            else {
                var error = {
                    errorpassword: "",
                    erroruser: "You don't have account...! Please registor before login!"
                }
                res.render("../views/login.ejs", { error: error });
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).send("Internal server error");
    }

});

app.get("/registration", (req, res) => {
    res.render("../views/registration.ejs")
});

app.post("/registration", async (req, res) => {
    const currect_user = req.body;
    const role = 'customer';

    try {
        connection.query("SELECT * FROM users WHERE email = ?", [currect_user.email], (error, results) => {
            if (error) {
                console.error("Database query error:", error);
                return;
            }

            // Check if we got results
            if (results.length > 0) {
                const user = results[0];
                var emailed = user.email;
                res.render("../views/login.ejs", { emailed: emailed })
            } else {
                if (currect_user.password === currect_user.confirmpassword) {
                    bcrypt.hash(currect_user.password, saltRound, async (error, hash) => {
                        if (error) {
                            console.log("Error hashing password", error);
                        }
                        else {

                            connection.query(
                                `INSERT INTO users VALUES(NULL,'${currect_user.name}','${currect_user.gender}','${currect_user.phone}',
                                '${currect_user.address}','${currect_user.email}','${hash}','${role}');`,
                                (err, result, fields) => {
                                    if (err) {
                                        console.error(err);
                                        res.status(500).json({ error: 'Database query error' });
                                    } else {
                                        global.user = currect_user.name;
                                        res.status(200).json(result);
                                    }
                                }
                            );


                        }
                    });

                }
            }
        });
    } catch (err) {
        console.log(err);
    }

});

// Middleware to check User role
const checkAuth = (req, res, next) => {
    if (global.user === 'Guests') {
        return res.redirect('/login');
    }
    next();
};

// Middleware to check admin role
const checkAdmin = (req, res, next) => {
    if (global.user === 'Guests') {
        return res.redirect('/login'); // Redirect to login if not logged in
    }
    // Query the database to check if the user is an admin
    connection.query("SELECT role FROM users WHERE name = ?", [global.user], (error, results) => {
        if (error || results.length === 0 || results[0].role !== "admin") {
            return res.redirect('/home'); // Redirect to home if not admin
        }
        next(); // Proceed to the admin page
    });
};

// Admin page route
app.get("/admin", checkAdmin, (req, res) => {
    global.active_link = "dashboard";
    res.render("../views/admin/dashboard.ejs"); // Render the admin dashboard
});
app.get("/invoice", checkAdmin, (req, res) => {
    global.active_link = "invoice";
    res.render("../views/admin/invoice.ejs"); // Render the admin dashboard
});
app.get("/user", checkAdmin, (req, res) => {
    global.active_link = "user";
    res.render("../views/admin/user.ejs"); // Render the admin dashboard
});

app.get("/category", checkAdmin, (req, res) => {
    global.active_link = "category";
    res.render("../views/admin/category.ejs"); // Render the admin dashboard
});
app.get("/style", checkAdmin, (req, res) => {
    global.active_link = "style";
    res.render("../views/admin/style.ejs"); // Render the admin dashboard
});
app.get("/condition", checkAdmin, (req, res) => {
    global.active_link = "condition";
    res.render("../views/admin/condition.ejs"); // Render the admin dashboard
});
app.get("/subcategory", checkAdmin, (req, res) => {
    global.active_link = "subcategory";
    res.render("../views/admin/subcategory.ejs"); // Render the admin dashboard
});
app.get("/size", checkAdmin, (req, res) => {
    global.active_link = "size";
    res.render("../views/admin/sizes.ejs"); // Render the admin dashboard
});
app.get("/product", checkAdmin, (req, res) => {
    global.active_link = "product";
    res.render("../views/admin/product.ejs"); // Render the admin dashboard
});





// Routes with authentication middleware
app.get("/login", (req, res) => {
    res.render("../views/login.ejs");
});

app.get("/registration", (req, res) => {
    res.render("../views/registration.ejs");
});

// Restricted routes - only accessible by logged-in users
app.get(["/", "/home", "/Home"], (req, res) => {
    global.active_link = "home";
    res.render("../views/index.ejs");
});
app.get("/shop", checkAuth, (req, res) => {
    global.active_link = "shop";
    res.render("../views/shop.ejs");

});
app.get("/about", (req, res) => {
    global.active_link = "about";
    res.render("../views/about.ejs");
});
app.get("/blog", (req, res) => {
    global.active_link = "blog";
    res.render("../views/blog.ejs");
});
app.get("/contact", checkAuth, (req, res) => {
    global.active_link = "contact";
    res.render("../views/contact.ejs");
});
app.get("/details", checkAuth, (req, res) => {
    global.active_link = "home";
    res.render("../views/details.ejs");
});
app.get("/faq", (req, res) => {
    global.active_link = "faq";
    res.render("../views/faq.ejs");
});



//--------------------API ENDPOINT--------------------//

//Get Product
app.get('/api/products', (req, res) => {
    connection.query(`SELECT products.id,product,price,discount,sub_category,condition_name,
                    image
                    FROM products 
                    INNER JOIN subcategory ON products.subcategory_id=subcategory.id
                    INNER JOIN conditions ON products.condition_id=conditions.id
                    where qty > 1
                    ;`
        , (err, results) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            } else {
                res.status(200).json(results);
            }
        });
});

app.get('/api/filtercategory', (req, res) => {
    const category_id = req.query.category_id;
    connection.query(`SELECT products.id,product,price,discount,sub_category,condition_name,
                    image
                    FROM products 
                    INNER JOIN subcategory ON products.subcategory_id=subcategory.id
                    INNER JOIN conditions ON products.condition_id=conditions.id
                    where category_id=${category_id} AND qty > 1`, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/filterSize', (req, res) => {
    const size_id = req.query.size_id;
    connection.query(`SELECT products.id,product,price,discount,sub_category,condition_name,
                    image
                    FROM products 
                    INNER JOIN subcategory ON products.subcategory_id=subcategory.id
                    INNER JOIN conditions ON products.condition_id=conditions.id 
                    where size_id=${size_id} AND qty > 1`, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/filterStyle', (req, res) => {
    const style_id = req.query.style_id;
    connection.query(`SELECT products.id,product,price,discount,sub_category,condition_name,
                    image
                    FROM products 
                    INNER JOIN subcategory ON products.subcategory_id = subcategory.id
                    INNER JOIN conditions ON products.condition_id = conditions.id 
                    where style_id = ${style_id} AND qty > 1`, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/filterCondition', (req, res) => {
    const condition_id = req.query.condition_id;
    connection.query(`SELECT products.id,product,price,discount,sub_category,condition_name,
                    image
                    FROM products 
                    INNER JOIN subcategory ON products.subcategory_id = subcategory.id
                    INNER JOIN conditions ON products.condition_id = conditions.id 
                    where products.condition_id =${condition_id} AND qty > 1`, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/filterSubcate', (req, res) => {
    const subCategory_id = req.query.subCategory_id;
    connection.query(`SELECT products.id,product,price,discount,sub_category,condition_name,
                    image
                    FROM products 
                    INNER JOIN subcategory ON products.subcategory_id = subcategory.id
                    INNER JOIN conditions ON products.condition_id = conditions.id 
                    where subcategory_id = ${subCategory_id} AND qty > 1`, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/get/allproduct', (req, res) => {
    connection.query(`
        select products.id,product,products.description AS description,qty,price,cost,discount,
        category, sub_category,condition_name,image,size_id,category_id,subcategory_id,style_id,condition_id,style_id
        FROM products 
        INNER JOIN subcategory ON products.subcategory_id=subcategory.id
        INNER JOIN conditions ON products.condition_id=conditions.id
        INNER JOIN categories ON products.category_id=categories.id
        ;`
        , (err, results) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            } else {
                res.status(200).json(results);
            }
        });
});

app.get('/api/get/product_detail', checkAdmin, (req, res) => {
    const product_id = req.query.product_id_detail;
    connection.query(`
        select products.id,product,products.description AS description,qty,price,cost,discount,
        category, sub_category,condition_name,image,size_id,category_id,subcategory_id,style_id,condition_id,style_id
        FROM products 
        INNER JOIN subcategory ON products.subcategory_id=subcategory.id
        INNER JOIN conditions ON products.condition_id=conditions.id
        INNER JOIN categories ON products.category_id=categories.id
        where products.id=${product_id}
        ;`
        , (err, results) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            } else {
                res.status(200).json(results);
            }
        });
});

app.post('/api/delete/product', checkAdmin, (req, res) => {
    const product_id = req.body.product_id;
    connection.query(
        `DELETE FROM products WHERE id = ${product_id};`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

app.post('/api/create/product', checkAdmin, upload.single('file'), (req, res) => {
    const product_item = req.body; // Form fields
    const uploadedFile = req.file; // Uploaded file

    // Ensure file handling is correct
    if (!uploadedFile) {
        return res.status(400).json({ error: 'File upload failed' });
    }

    // Database query
    connection.query(
        `INSERT INTO products 
       VALUES (NULL, '${product_item.name}', '${product_item.descriotion}', '${product_item.qty}', 
       '${product_item.price}', '${product_item.cost}', '${product_item.discount}', 
       '${product_item.size}', '${product_item.category}', '${product_item.style}', 
       '${product_item.subcategory}', '${product_item.condition}', '/img/${uploadedFile.filename}');`,
        (err, result) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            } else {
                res.status(200).json(result);
            }
        }
    );
});

app.post('/api/update/product', checkAdmin, upload.single('file'), (req, res) => {
    const product_item = req.body; // Form fields
    const uploadedFile = req.file; // Uploaded file

    // Ensure file handling is correct
    if (!uploadedFile) {
        return res.status(400).json({ error: 'File upload failed' });
    }
    connection.query(
        `UPDATE products SET product = "${product_item.name}", description = "${product_item.descrition}",
        qty = '${product_item.qty}',price = '${product_item.price}',cost='${product_item.cost}',
        discount = '${product_item.discount}',size_id='${product_item.size}',category_id='${product_item.category}',
        style_id='${product_item.style}',subcategory_id='${product_item.subcategory}',
        condition_id='${product_item.condition}',image='/img/${product_item.image_name}' 
        WHERE id = ${product_item.id};`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

app.get('/search/product', (req, res) => {
    const product_name = req.query.searchname;
    connection.query(`
        select products.id,product,products.description AS description,qty,price,cost,discount,
        category, sub_category,condition_name,image,size_id,category_id,subcategory_id,style_id,condition_id,style_id
        FROM products 
        INNER JOIN subcategory ON products.subcategory_id=subcategory.id
        INNER JOIN conditions ON products.condition_id=conditions.id
        INNER JOIN categories ON products.category_id=categories.id
        where product like "${product_name}%";`
        , (err, results) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            } else {
                res.status(200).json(results);
            }
        });
});






//Count In Dashboard

app.get('/api/count/user', checkAdmin, (req, res) => {
    connection.query(`SELECT COUNT(*) as countuser FROM users`, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/count/product', checkAdmin, (req, res) => {
    connection.query(`SELECT COUNT(*) as countproduct FROM products`, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/count/income', checkAdmin, (req, res) => {
    connection.query(`SELECT ROUND(SUM(Total_amount),2) as sumIncome FROM invoice;`, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});


//Invoice

app.get('/api/list/invoice', checkAdmin, (req, res) => {
    connection.query(`
        SELECT Invoice_id,users.email as email,Total_amount,
        DATE_FORMAT(transaction_datetime, '%Y-%m-%d %H:%i:%s') AS formatted_datetime
        FROM invoice INNER JOIN users ON invoice.user_id = users.id
        ORDER BY invoice_id DESC LIMIT 5;
        `, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/list/allinvoice', checkAdmin, (req, res) => {
    connection.query(`
        SELECT Invoice_id,DATE_FORMAT(transaction_datetime, '%Y-%m-%d %H:%i:%s') AS formatted_datetime,
        Total_amount, discount
        FROM invoice
        order by invoice_id desc;
        `, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/list/searchInvoiceID', checkAdmin, (req, res) => {
    const invoice_id = req.query.invoice_id;
    console.log(invoice_id);
    connection.query(`
        SELECT * FROM invoice where invoice_id = ${invoice_id} order by invoice_id desc
        `, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/list/InvoiceDetail', checkAdmin, (req, res) => {
    const invoice_id = req.query.invoice_id;
    connection.query(`
        SELECT products.id as product_id,product,invoice_detail.qty as order_qty 
        FROM invoice_detail INNER JOIN products ON invoice_detail.product_id=products.id
        WHERE Invoice_id = ${invoice_id}
        ;
        `, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});


// User Page
app.get('/api/list/alluser', checkAdmin, (req, res) => {
    connection.query(`
        SELECT * FROM users ORDER BY users.id ASC;
        `, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/list/FilteruserAdmin', checkAdmin, (req, res) => {
    connection.query(`
        SELECT * FROM users where role = 'admin';
        `, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/list/Filterusercustomer', checkAdmin, (req, res) => {
    connection.query(`
        SELECT * FROM users where role = 'customer';
        `, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.post('/api/create/user', checkAdmin, (req, res) => {
    const user = req.body;

    bcrypt.hash(user.password, saltRound, async (error, hash) => {
        connection.query(
            `INSERT INTO users VALUES(NULL,'${user.name}','${user.gender}','${user.phone}','${user.address}','${user.email}','${hash}','${user.role}');`,
            (err, result, fields) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({ error: 'Database query error' });
                }
                else {
                    res.status(200).json(result);
                }
            }
        );
    });
});

app.post('/api/delete/user', checkAdmin, (req, res) => {
    const user_id = req.body.user_id;
    connection.query(
        `DELETE FROM users WHERE users.id = ${user_id};`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

app.post('/api/update/user', checkAdmin, (req, res) => {
    const user = req.body;

    bcrypt.hash(user.password, saltRound, async (error, hash) => {
        connection.query(
            `UPDATE users SET name = '${user.name}', gender = '${user.gender}', phone = '${user.phone}',
            address = '${user.address}', email = '${user.email}', password = '${hash}', role = '${user.role}' WHERE id = ${user.id};`,
            (err, result, fields) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({ error: 'Database query error' });
                }
                else {
                    res.status(200).json(result);
                }
            }
        );
    });
});

app.get('/api/detail/user', checkAdmin, (req, res) => {
    const id = req.query.user_id;
    connection.query(`
        SELECT * FROM users where id = ${id};
        `, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

// Category page
app.get(['/api/list/allcategory', '/api/category'], (req, res) => {
    connection.query(`
        SELECT * FROM categories;
        `, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.post('/api/create/category', checkAdmin, (req, res) => {
    const category = req.body;
    connection.query(
        `INSERT INTO categories VALUES(NULL,'${category.name}','${category.description}');`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

app.post('/api/delete/category', checkAdmin, (req, res) => {
    const category_id = req.body.category_id;
    connection.query(
        `DELETE FROM categories WHERE id = ${category_id};`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

app.post('/api/update/category', checkAdmin, (req, res) => {
    const category = req.body;
    connection.query(
        `UPDATE categories SET category = '${category.name}', description = '${category.description}' WHERE id = ${category.id};`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

// Style Page
app.get(['/api/list/allstyle', '/api/style'], (req, res) => {
    connection.query(`
        SELECT * FROM styles;
        `, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.post('/api/create/style', checkAdmin, (req, res) => {
    const style_item = req.body;
    connection.query(
        `INSERT INTO styles VALUES(NULL,'${style_item.name}','${style_item.description}');`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

app.post('/api/delete/style', checkAdmin, (req, res) => {
    const style_id = req.body.style_id;
    connection.query(
        `DELETE FROM styles WHERE id = ${style_id};`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

app.post('/api/update/style', checkAdmin, (req, res) => {
    const style_item = req.body;
    connection.query(
        `UPDATE styles SET style = '${style_item.name}', description = '${style_item.description}' WHERE id = ${style_item.id};`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

//Condition Page
app.get(['/api/list/allcondition', '/api/conditon'], (req, res) => {
    connection.query(`
        SELECT * FROM conditions;
        `, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.post('/api/create/condition', checkAdmin, (req, res) => {
    const condition_item = req.body;
    connection.query(
        `INSERT INTO conditions VALUES(NULL,'${condition_item.name}','${condition_item.description}');`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

app.post('/api/delete/condition', checkAdmin, (req, res) => {
    const condition_id = req.body.condition_id;
    connection.query(
        `DELETE FROM conditions WHERE id = ${condition_id};`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

app.post('/api/update/condition', checkAdmin, (req, res) => {
    const condition_item = req.body;
    connection.query(
        `UPDATE conditions SET condition_name = '${condition_item.name}', description = '${condition_item.description}' WHERE id = ${condition_item.id};`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

//Sub Category
app.get(['/api/list/allsubCategory', '/api/subcategory'], (req, res) => {
    connection.query(`
        SELECT * FROM subcategory;
        `, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.post('/api/create/subCategory', checkAdmin, (req, res) => {
    const subcategory_item = req.body;
    connection.query(
        `INSERT INTO subcategory VALUES(NULL,'${subcategory_item.name}','${subcategory_item.description}');`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

app.post('/api/delete/subCategory', checkAdmin, (req, res) => {
    const subcategory_id = req.body.subcategory_id;
    connection.query(
        `DELETE FROM subcategory WHERE id = ${subcategory_id};`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

app.post('/api/update/subCategory', checkAdmin, (req, res) => {
    const subcategory_item = req.body;
    connection.query(
        `UPDATE subcategory SET sub_category = '${subcategory_item.name}', description = '${subcategory_item.description}' WHERE id = ${subcategory_item.id};`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

//Size 
app.get(['/api/list/allsizes', '/api/size'], (req, res) => {
    connection.query(`
        SELECT * FROM sizes;
        `, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.post('/api/create/sizes', checkAdmin, (req, res) => {
    const size_item = req.body;
    connection.query(
        `INSERT INTO sizes VALUES(NULL,'${size_item.name}','${size_item.description}');`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

app.post('/api/delete/sizes', checkAdmin, (req, res) => {
    const size_id = req.body.size_id;
    connection.query(
        `DELETE FROM sizes WHERE id = ${size_id};`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});

app.post('/api/update/sizes', checkAdmin, (req, res) => {
    const size_item = req.body;
    connection.query(
        `UPDATE sizes SET sizes = '${size_item.name}', description = '${size_item.description}' WHERE id = ${size_item.id};`,
        (err, result, fields) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Database query error' });
            }
            else {
                res.status(200).json(result);
            }
        }
    );
});






const sendMessage = async (message) => {
    try {
        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: process.env.CHAT_ID,
            text: message
        });
        // console.log('Message sent:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
};


//Payment with data
app.post('/api/payment', (req, res) => {
    const cart_list = req.body.cart_list;
    const total_price = req.body.total_price.toFixed(2);
    const discount = req.body.discount;


    const productDetails = cart_list.map((item, index) => `
        Product ID: ${item.product_id}
        Product Name: ${item.name}
        Product Qty: ${item.qty}
        `).join('\n');

    let date_time = new Date();
    let datetime = date_time.getFullYear() + "-" + ("0" + (date_time.getMonth() + 1)).slice(-2) + "-" + ("0" + date_time.getDate()).slice(-2) + " " + date_time.getHours() + ":" + date_time.getMinutes() + ":" + date_time.getSeconds();

    const message = `🔔New Confirm information🔔
Email  :   ${global.user}
Product information    
----------------------------------
    ${productDetails}
----------------------------------
Order Date 📅: ${datetime}
Discount: %${discount}
Total Price 🤑: $${total_price}
    `

    sendMessage(message).then(() => {
        res.send('Message sent to Telegram!');
    }).catch((err) => {
        res.status(500).send('Error sending message');
    });

    Invoice(total_price, discount, datetime, (err, insertId) => {
        if (err) {
            console.error('Error inserting invoice:', err);
        } else {
            InvoiceDetail(cart_list, insertId);
            update_Stock(cart_list);
        }
    });



});

function Invoice(total_price, discount, datetime, callback) {
    console.log(global.userId);
    try {
        connection.query(
            `INSERT INTO invoice VALUES(NULL,${total_price},'${datetime}',${discount},${global.userId});`,
            function (err, result) {
                if (err) {
                    callback(err, null); // Pass error to the callback
                } else {
                    callback(null, result.insertId); // Pass the insertId to the callback
                }
            }
        );
    } catch (err) {
        callback(err, null); // Pass any other error to the callback
    }
}

function InvoiceDetail(cart_list, insertId) {
    try {
        cart_list.forEach(product => {
            connection.query(
                `INSERT INTO invoice_detail VALUES(${insertId},${product.product_id},${product.qty});`, function (err, result, fields) {
                    if (err) throw err;
                }
            );
        });

    } catch (err) {
        console.log(err);
    }
};
function update_Stock(cart_list) {
    try {
        cart_list.forEach(product => {
            connection.query(
                `UPDATE products SET qty = qty - ${product.qty} WHERE products.id = ${product.product_id};`, function (err, result, fields) {
                    if (err) throw err;
                }
            );
        });

    } catch (err) {
        console.log(err);
    }
}

app.post('/contact', (req, res) => {
    const name = req.body.name;
    const gmail = req.body.gmail;
    const phone = req.body.phone;
    const messageinfor = req.body.message;


    const message = `
            Contact for more information🔔🔔🔔
================================
    Name: ${name}
    Gmail: ${gmail}
    phone: ${phone}
    Message: 
    ${messageinfor}
================================
    Please Reply this message...!
    🛎️🛎️🛎️🛎️🛎️🛎️🛎️🛎️🛎️🛎️🛎️🛎️
    `;

    sendMessage(message).then(() => {
        res.send('Message sent to Telegram!');
    }).catch((err) => {
        res.status(500).send('Error sending message');
    });

});









// Error 404
app.get('*', function (req, res) {
    res.render("../views/error/404.ejs");
});
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
