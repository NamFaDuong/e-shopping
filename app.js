import dotenv from 'dotenv';
import express, { query } from 'express'
import bodyParser from 'body-parser';
import mysql from 'mysql'
import bcrypt, { hash } from 'bcrypt'
// import cors from 'cors';
dotenv.config();

const app = express();
// app.use(cors());
const saltRound = 10;
app.use(express.static("public"))


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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

                bcrypt.compare(loginPassword, storedPassword, (error, results) => {
                    if (error) {
                        console.log("Error comparing password", error);
                    }
                    else {
                        if (results) {
                            global.user = email;
                            // Redirect based on role
                            if (role === "admin") {
                                return res.redirect("/admin");
                            } else {
                                return res.redirect("/home");
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
})

app.post("/registration", async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    const confirmpassword = req.body.confirmpassword;

    try {
        connection.query("SELECT * FROM users WHERE email = ?", [email], (error, results) => {
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
                if (password === confirmpassword) {
                    bcrypt.hash(password, saltRound, async (error, hash) => {
                        if (error) {
                            console.log("Error hashing password", error);
                        }
                        else {
                            const result = connection.query(
                                "INSERT INTO users (email, password) VALUES ('" + email + "', '" + hash + "')"
                            );
                            global.user = email;
                            res.render("../views/index.ejs");
                        }
                    });

                }
            }
        });
    } catch (err) {
        console.log(err);
    }

})

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
    connection.query("SELECT role FROM users WHERE email = ?", [global.user], (error, results) => {
        if (error || results.length === 0 || results[0].role !== "admin") {
            return res.redirect('/home'); // Redirect to home if not admin
        }
        next(); // Proceed to the admin page
    });
};



// Admin page route
app.get("/admin", checkAdmin, (req, res) => {
    res.render("../views/admin/dashboard.ejs"); // Render the admin dashboard
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
app.get("/about", checkAuth, (req, res) => {
    global.active_link = "about";
    res.render("../views/about.ejs");
});
app.get("/blog", checkAuth, (req, res) => {
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
app.get("/faq", checkAuth, (req, res) => {
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

//Get Category
app.get('/api/category', (req, res) => {
    connection.query('Select * from categories', (err, results) => {
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





//Get condition
app.get('/api/conditon', (req, res) => {
    connection.query('Select * from conditions', (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});
//Get size
app.get('/api/size', (req, res) => {
    connection.query('Select * from sizes', (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});
//Get style
app.get('/api/style', (req, res) => {
    connection.query('Select * from styles', (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});
//Get subcategory
app.get('/api/subcategory', (req, res) => {
    connection.query('Select * from subcategory', (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Database query error' });
        } else {
            res.status(200).json(results);
        }
    });
});

//Payment with data
app.post('/api/payment', (req, res) => {
    const cart_list = req.body.cart_list;
    const total_price = req.body.total_price;
    
});









// Error 404
app.get('*', function (req, res) {
    res.render("../views/error/404.ejs");
});
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
