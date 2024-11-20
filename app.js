import dotenv from 'dotenv';
import express, { Router } from 'express'
import bodyParser from 'body-parser';
import mysql from 'mysql'
import bcrypt, { hash } from 'bcrypt'

dotenv.config();

const app = express();
const saltRound = 10;
app.use(express.static("public"))


app.use(bodyParser.urlencoded({ extended: true }));

const connection = new mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

connection.connect();

global.user = 'Guests';
app.get("/login", (req, res) => {
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
                res.render("../views/login.ejs", { error: error })
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

    connection.query("Select * from products", (error, result) => {
        if (error) {
            console.log("Error selecting", error);
        } else {
            if (result) {
                const data = JSON.stringify(result);
                res.render("../views/shop.ejs", { data: data });
            }
        }
    });

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

// Error 404
app.get('*', function (req, res) {
    res.render("../views/error/404.ejs");
});








const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
