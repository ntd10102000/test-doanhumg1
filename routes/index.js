var express = require('express'); // require Express
var router = express.Router(); // setup usage of the Express router engine
var path = require("path");
var shapefile = require("shapefile");
var multer = require('multer');


/* PostgreSQL and PostGIS module and connection setup */
const { Client, Query } = require('pg')

// Setup connection
var username = "postgres" // sandbox username
var password = "nguyentienduong1" // read only privileges on our table
var host = "localhost:5432"
var database = "qly_sv" // database name
var conString = "postgres://" + username + ":" + password + "@" + host + "/" + database; // Your Database Connection

// Set up your database query to display GeoJSON
var coffee_query = "SELECT row_to_json(fc) FROM (SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry,row_to_json((type_1, name_1)) As properties FROM vnm_adm1 As lg) As f) As fc";
var book_query = "select title, address, time, img, long, lat from db_maps";

/* GET home page. */
var table_name;
var obj;
var type;
var shape_type;
var lat = [];
var lng = [];
var latt;
var lngg;
var coord;
router.get('/', function(req, res, next) {
    res.render('login', { title: 'Express' });
});

router.get('/login', function(req, res, next) {

    res.render('login', { title: 'Login' });
});

router.post('/login', async function(req, res, next) {
    const us = req.body.us;
    const pa = req.body.pa;
    var check_us = `select * from tbl_tk where us like '${us}' and pa like '${pa}'`;
    var client = await new Client(conString);
    await client.connect();
    await client.query(new Query(check_us), async function(err, result) {
        if (err) throw err;
        if (result.rowCount == 0) {
            console.log("sai tai khoan or mk");
            await res.redirect("../login");
        } else {
            if (result.rows[0].us === "admin") {
                req.session.Admin = req.body.us;
                await res.redirect("/manager");
                console.log(req.session.Admin);
            } else {
                req.session.User = req.body.us;
                await res.redirect("/manage");
                console.log(req.session.User);
            }

        }
    });
    // await res.redirect("/profile");
});

router.get('/signup', function(req, res, next) {
    res.render('signup', { title: 'Signup' });
});

router.get('/quanlycacbang', function(req, res, next) {
    res.render('manage1', { title: 'Quan ly cac bang' });
});

const bodyParser = require("body-parser");
const { render } = require('pug');
router.use(bodyParser.urlencoded({ extended: true }));

router.post('/signup-dk', async function(req, res, next) {
    const us = req.body.us;
    const pa = req.body.pa;
    const rpa = req.body.rpa;
    var client = await new Client(conString);
    await client.connect();
    var sql_text = "INSERT INTO tbl_tk (us, pa) " +
        `VALUES ('${us}', '${pa}');`;
    var createdatabase = `CREATE DATABASE ${us} WITH OWNER = postgres ENCODING = 'UTF8' LC_COLLATE = 'English_United States.1252' LC_CTYPE = 'English_United States.1252' TABLESPACE = pg_default CONNECTION LIMIT = -1;`;
    // var createextension = `CREATE EXTENSION postgis SCHEMA public VERSION "3.1.0";`;
    // var client = new Client(conString);
    // client.connect();
    // var query = client.query(new Query(sql_text));
    var qr_check_ten_tk = `SELECT * FROM tbl_tk WHERE us like '${us}';`;
    if (pa != rpa) {
        console.log("nhap lai mat khau khong dung");
        res.redirect('/signup');
    } else if (pa.length < 1) {
        console.log("mk pai lon hon 1 ky tu");
        res.redirect('/signup');
    } else {
        await client.query(new Query(qr_check_ten_tk), async function(err, result) {
            if (err) throw err;
            if (result.rowCount == 0) {
                console.log(result);
                await client.query(new Query(sql_text));
                await client.query(new Query(createdatabase));
                var conString_us = "postgres://" + username + ":" + password + "@" + host + "/" + us;
                setTimeout(async function() {
                    var client_us = await new Client(conString_us);
                    await client_us.connect();
                    var createextension = `CREATE EXTENSION postgis SCHEMA public;`;
                    await client_us.query(new Query(createextension), function(err, result) {
                        if (err) {
                            return console.error('Error executing query extension', err.stack);
                        }
                    });
                }, 5000);
                // client.query(new Query(createextension));
            } else {
                console.log(result);
                console.log("Ten dang nhap da ton tai");
                res.redirect('/signup');
            }
        });
    }
    await res.redirect('/login');
});

router.get('/profile', function(req, res, next) {
    if (req.session.User != null) {
        res.render('import', { title: 'Import shp' });
    } else {
        res.redirect("/login");
    }
});

function insert_shapefile(pool, tb_name, rs) {
    // shapefile.open("uploads/" + file_name).then(source => source.read().then(async function log(results) {
    //     if (results.done)
    //         return;
    var com = ",";
    var query_insert_data = "insert into " + tb_name.toLowerCase() + " values(";
    for (var i = 0; i < type.length; i++) {
        console.log("type of type: " + typeof type[i]);
        if (typeof type[i] === "string") {
            query_insert_data += "'" + type[i] + "'" + com;
        } else if (typeof type[i] === "string" && type[i] === "") {
            query_insert_data += "'null'" + com;
        } else if (typeof type[i] === "number" && type[i] === "") {
            query_insert_data += 0 + com;
        } else if (typeof type[i] === "object") {
            query_insert_data += type[i] + com;
        } else {
            query_insert_data += type[i] + com;
        }
    }
    // await console.log(query_insert_data);
    if (shape_type.toUpperCase() == "POINT") {
        lngg = rs.value.geometry.coordinates[0];
        latt = rs.value.geometry.coordinates[1];
        query_insert_data += "ST_SetSRID(ST_MakePoint(" + lngg + "," + latt + "), 4326)";
    }
    var line_point = "";
    // await console.log(query_insert_data);
    if (shape_type.toUpperCase() == "LINESTRING" || shape_type.toUpperCase() == "MULTILINESTRING") {
        coord = rs.value.geometry.coordinates;
        // console.log(coord.length);
        for (var j = 0; j < coord.length; j++) {
            if (j < coord.length - 1) {
                line_point += "ST_MakePoint(" + coord[j] + ")" + com;
            } else {
                line_point += "ST_MakePoint(" + coord[j] + ")";
            }
        }
        query_insert_data += "ST_SetSRID(ST_MakeLine(ARRAY[" + line_point + "]),4326)"
    }
    // await console.log(query_insert_data);

    if (shape_type.toUpperCase() == "POLYGON") {
        coord = rs.value.geometry.coordinates[0];
        //console.log(coord);
        for (var j = 0; j < coord.length; j++) {
            if (j < coord.length - 1) {
                line_point += "ST_MakePoint(" + coord[j] + ")" + com;
            } else {
                line_point += "ST_MakePoint(" + coord[j] + ")";
            }
        }
        query_insert_data += "ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[" + line_point + "])),4326)"
    }
    query_insert_data += ");";
    // await console.log(query_insert_data);

    pool.query(query_insert_data, function(err, result) {
        if (err) {
            // return console.error('Error executing query insert', err.stack);
        } else {
            // console.log("insert value thanh cong");
        }
        // console.log("insert value thanh cong");
        //res.redirect("../db/list_table");
    });
    //     return source.read().then(log);

    // })).catch(error => console.error(error.stack));
    // console.timeEnd("time");
};

var store = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function(req, file, cb) {
        cb(null, file.originalname);
        // if (path.extname(file.originalname) == ".shp") {
        //     table_name = path.parse(file.originalname).name;
        //     shapefile.open("uploads/" + file.originalname).then(source => source.read().then(function log(results) {
        //         if ("loi" + results.done)
        //             return;
        //         // console.log("toa do diem dau tien" + results.value.geometry.coordinates);
        //         obj = Object.keys(results.value.properties);
        //         type = Object.values(results.value.properties);
        //         // console.log(obj);
        //         // console.log(type);
        //         // console.log(obj.length);
        //         // console.log(results.value.geometry.coordinates);
        //         var query_create_database = "CREATE TABLE " + table_name + "(";

        //         var com = ",";
        //         for (i = 0; i < obj.length; i++) {
        //             if (typeof type[i] === "string")
        //                 query_create_database += obj[i] + ' varchar ' + com;
        //             if (typeof type[i] === "number")
        //                 query_create_database += obj[i] + ' float ' + com;
        //             if (typeof type[i] === "object")
        //                 query_create_database += obj[i] + ' varchar ' + com;
        //         }
        //         shape_type = results.value.geometry.type;
        //         if (shape_type.toUpperCase() == "POINT") {
        //             lng.push(results.value.geometry.coordinates[0]);
        //             lat.push(results.value.geometry.coordinates[1]);
        //         }
        //         client_us.query(query_create_database, function(err, result) {
        //             if (err) {
        //                 return console.error('Error executing query 123', err.stack);
        //             }
        //         });
        //         return source.read().then(log);
        //     })).catch(error => console.error(error.stack));
        // }
    }
});
var upload = multer({ storage: store });

router.post('/profile', upload.single("shp"), async function(req, res, next) {
    const example = req.file;
    var time = 1000;
    if (req.session.User != null) {
        var conString_user = "postgres://" + username + ":" + password + "@" + host + "/" + req.session.User;
        // console.log(req.session.User);
        var client_us = new Client(conString_user);
        client_us.connect();
        if (path.extname(example.originalname) == ".shp") {
            table_name = path.parse(example.originalname).name;
            await shapefile.open("uploads/" + example.originalname).then(source => source.read().then(async function log(results) {
                if (results.done)
                    return;

                // console.log("toa do diem dau tien" + results.value.geometry.coordinates);
                obj = Object.keys(results.value.properties);
                type = Object.values(results.value.properties);
                // console.log(obj);
                // console.log(type);
                // console.log(obj.length);
                // console.log(results.value.geometry.coordinates);
                var query_create_database = "CREATE TABLE " + table_name + "(";

                var com = ",";
                for (i = 0; i < obj.length; i++) {
                    if (typeof type[i] === "string")
                        query_create_database += obj[i] + ' varchar ' + com;
                    if (typeof type[i] === "number")
                        query_create_database += obj[i] + ' float ' + com;
                    if (typeof type[i] === "object")
                        query_create_database += obj[i] + ' varchar ' + com;
                }
                // console.log(results.value.geometry.coordinates[0]);
                // console.log(results.value.geometry.coordinates[1]);

                shape_type = results.value.geometry.type;
                if (shape_type.toUpperCase() == "POINT") {
                    lng.push(results.value.geometry.coordinates[0]);
                    lat.push(results.value.geometry.coordinates[1]);
                }
                query_create_database += "geom geometry(" + shape_type.toUpperCase() + ",4326));";

                await client_us.query(query_create_database, async function(err, result) {
                    if (err) {
                        // return console.error('Error executing query 123', err.stack);
                    } else {
                        console.log("Create table thành công");
                        var query_alter_geom = "ALTER TABLE " + table_name + " ALTER COLUMN geom SET DATA TYPE geometry;";
                        await client_us.query(query_alter_geom, async function(err, result) {
                            if (err) {
                                return console.error('Error executing query', err.stack);
                            } else {
                                console.log("ALTER TABLE " + table_name + " thành công");
                            }
                            //res.redirect("../db/list_table");
                        });

                    }
                });
                await insert_shapefile(client_us, table_name, results);
                time += 10;
                return source.read().then(log);
            })).catch(error => console.error(error.stack));
            res.render('loading', { t: time });

        }

        // var query_create_database = "CREATE TABLE " + table_name + "(";
        // shapefile.open("uploads/" + table_name + ".shp").then(source => source.read().then(function log(results) {
        //     if ("lloix day" + results.done)
        //         return;

        //     obj = Object.keys(results.value.properties);
        //     type = Object.values(results.value.properties);
        //     // console.log("object:" + obj);
        //     // console.log("type:" + type);

        //     shape_type = results.value.geometry.type;
        //     // console.log(table_name);

        // var com = ",";
        // for (i = 0; i < obj.length; i++) {
        //     if (typeof type[i] === "string")
        //         query_create_database += obj[i] + ' varchar ' + com;
        //     if (typeof type[i] === "number")
        //         query_create_database += obj[i] + ' float ' + com;
        //     if (typeof type[i] === "object")
        //         query_create_database += obj[i] + ' varchar ' + com;
        // }
        // query_create_database += "geom geometry(" + shape_type.toUpperCase() + ",4326));";
        // console.log("query:" + query_create_database);

        // var query_alter_geom = "ALTER TABLE " + table_name + " ALTER COLUMN geom TYPE geometry (multipolygon, 4326) USING ST_Multi(geom);";
        // client_us.query(query_alter_geom, function(err, result) {
        //     if (err) {
        //         return console.error('Error executing query', err.stack);
        //     } else {

        //     }
        //     //res.redirect("../db/list_table");
        // });



        //     return source.read().then(log);
        // })).catch(error => console.error(error.stack));
        // await shapefile.open("uploads/" + table_name + ".shp").then(source => source.read().then(async function log(results) {
        //     if ("lloix day nay" + results.done)
        //         return;
        //     var com = ",";

        //     var query_insert_data = "insert into " + table_name.toLowerCase() + " values(";
        //     for (var i = 0; i < type.length; i++) {
        //         console.log("type of type: " + typeof type[i]);
        //         if (typeof type[i] === "string") {
        //             query_insert_data += await "'" + type[i] + "'" + com;
        //         } else if (typeof type[i] === "string" && type[i] === "") {
        //             query_insert_data += await "'null'" + com;
        //         } else if (typeof type[i] === "number" && type[i] === "") {
        //             query_insert_data += await 0 + com;
        //         } else if (typeof type[i] === "object") {
        //             query_insert_data += await type[i] + com;
        //         } else {
        //             query_insert_data += await type[i] + com;
        //         }

        //     }
        //     // await console.log(query_insert_data);
        //     if (shape_type.toUpperCase() == "POINT") {
        //         lng = await results.value.geometry.coordinates[0];
        //         lat = await results.value.geometry.coordinates[1];
        //         query_insert_data += await "ST_SetSRID(ST_MakePoint(" + lng + "," + lat + "),4326)";
        //     }
        //     var line_point = "";
        //     // await console.log(query_insert_data);
        //     if (shape_type.toUpperCase() == "LINESTRING" || shape_type.toUpperCase() == "MULTILINESTRING") {
        //         coord = results.value.geometry.coordinates;
        //         // console.log(coord.length);
        //         for (var j = 0; j < coord.length; j++) {
        //             if (j < coord.length - 1) {
        //                 line_point += await "ST_MakePoint(" + coord[j] + ")" + com;
        //             } else {
        //                 line_point += await "ST_MakePoint(" + coord[j] + ")"
        //             }
        //         }
        //         query_insert_data += await "ST_SetSRID(ST_MakeLine(ARRAY[" + line_point + "]),4326)"
        //     }
        //     // await console.log(query_insert_data);

        //     if (shape_type.toUpperCase() == "POLYGON") {
        //         coord = await results.value.geometry.coordinates[0];
        //         //console.log(coord);
        //         for (var j = 0; j < coord.length; j++) {
        //             if (j < coord.length - 1) {
        //                 line_point += await "ST_MakePoint(" + coord[j] + ")" + com;
        //             } else {
        //                 line_point += await "ST_MakePoint(" + coord[j] + ")"
        //             }
        //         }
        //         query_insert_data += await "ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[" + line_point + "])),4326)"
        //     }
        //     query_insert_data += await ");";
        //     // await console.log(query_insert_data);

        //     // await client_us.query(query_insert_data, async function(err, result) {
        //     //     if (err) {
        //     //         return console.error('Error executing query', err.stack);
        //     //     }
        //     //     // console.log("insert value thanh cong");
        //     //     //res.redirect("../db/list_table");
        //     // });

        //     // await console.log(query_insert_data);
        //     // await console.log(query_create_database);


        //     return source.read().then(log);
        // })).catch(error => console.error(error.stack));
        // var com = ",";
        // await shapefile.open("uploads/" + table_name + ".shp").then(source => source.read().then(async function log(results) {
        //     if (results.done)
        //         return;

        //     obj = await Object.keys(results.value.properties);
        //     type = await Object.values(results.value.properties);
        //     console.log("object:" + obj);
        //     console.log("type:" + type);

        //     shape_type = await results.value.geometry.type;




        //     return source.read().then(log);
        //     //res.redirect("../db/list_table");
        // })).catch(error => console.error(error.stack));
    } else {
        res.redirect("/login");
    }

});



router.get('/manage', function(req, res) {
    var conString_user = "postgres://" + username + ":" + password + "@" + host + "/" + req.session.User;
    // console.log(req.session.User);
    var client_us = new Client(conString_user);
    client_us.connect();
    if (req.session.User != null) {
        var show_table = "SELECT * FROM geometry_columns";
        client_us.query(show_table, function(err, result) {
            if (err) throw err;
            else {
                res.render("manage", { ds: result, username: req.session.User });
            }
            //console.log(result);
        });
    } else {
        res.redirect("login");
    }

});

router.get('/manager', function(req, res) {
    var conString_admin = "postgres://" + username + ":" + password + "@" + host + "/" + database;
    // console.log(req.session.User);
    var client_admin = new Client(conString_admin);
    client_admin.connect();
    if (req.session.Admin != null) {
        var show_table = "SELECT * FROM tbl_tk order by id DESC";
        var amount_user = "SELECT COUNT(id) as count_user FROM tbl_tk";
        client_admin.query(show_table, function(err, results) {
            if (err) throw err;
            else {
                client_admin.query(amount_user, function(err, result) {
                    if (err) throw err;
                    else {
                        res.render("manager", { ds: results, username: req.session.Admin, count: result.rows[0].count_user });
                    }
                    //console.log(result);
                });
                // res.render("manager", { ds: result, username: req.session.Admin });
            }
            //console.log(result);
        });
    } else {
        res.redirect("../login");
    }

});

var show_data;

router.get('/showmaps/:id', function(req, res) {
    var table_name_us = req.params.id;
    console.log(table_name_us);
    show_data = "SELECT row_to_json(fc) FROM (SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry FROM " + table_name_us + " As lg) As f) As fc";
    console.log(show_data);
    var conString_user = "postgres://" + username + ":" + password + "@" + host + "/" + req.session.User;
    // console.log(req.session.User);
    var client_us = new Client(conString_user);
    client_us.connect();
    if (req.session.User != null) {
        client_us.query(show_data, function(err, result, row) {
            if (err) {
                res.end();
                return console.error('error running query', err);
            }
            result.addRow(row);
            var data = result.rows[0].row_to_json
            console.log(data); // Save the JSON as variable data
            res.render('map', {
                title: "Express API", // Give a title to our page
                jsonData: data // Pass data to the View
            });
        });
    } else {
        res.redirect("../login");
    }

});

router.get('/manage/:id', function(req, res) {
    var usn = req.params.id;
    var conString_user = "postgres://" + username + ":" + password + "@" + host + "/" + usn;
    // console.log(req.session.User);
    var client_us = new Client(conString_user);
    client_us.connect();
    if (req.session.Admin != null) {
        var show_table = "SELECT * FROM geometry_columns";
        client_us.query(show_table, function(err, result) {
            if (err) throw err;
            else {
                res.render("manager-user", { ds: result, username: usn, admin: req.session.Admin });
            }
            //console.log(result);
        });
    } else {
        res.redirect("../login");
    }

});

var remote_table;
router.get('/deletetable/:id', function(req, res) {
    var table_name_us = req.params.id;
    remote_table = "DROP TABLE " + table_name_us;
    var conString_user = "postgres://" + username + ":" + password + "@" + host + "/" + req.session.User;
    // console.log(req.session.User);
    var client_us = new Client(conString_user);
    client_us.connect();
    if (req.session.User != null) {
        client_us.query(remote_table, function(err, result, row) {
            if (err) {
                res.end();
                return console.error('error running query', err);
            }
            console.log("Drop " + table_name_us + " thành công");
            res.redirect("../manage");
        });
    } else {
        res.redirect("../login");
    }

});

var ProgressBar = require('progressbar.js');

router.get('/loading', function(req, res) {
    res.render("loading");
});

module.exports = router;

/* GET Postgres JSON data */
router.get('/data', function(req, res) {
    var client = new Client(conString);
    client.connect();
    var query = client.query(new Query(coffee_query));
    query.on("row", function(row, result) {
        result.addRow(row);
    });
    query.on("end", function(result) {
        res.send(result.rows[0].row_to_json);
        res.end();
    });
});

/* GET the map page */
router.get('/map', function(req, res) {
    var client = new Client(conString); // Setup our Postgres Client
    client.connect(); // connect to the client
    var query = client.query(new Query(coffee_query)); // Run our Query
    query.on("row", function(row, result) {
        result.addRow(row);
    });
    // Pass the result to the map page
    query.on("end", function(result) {
        var data = result.rows[0].row_to_json // Save the JSON as variable data
        res.render('map', {
            title: "Express API", // Give a title to our page
            jsonData: data // Pass data to the View
        });
    });
});

router.get('/map-book', function(req, res) {
    var client = new Client(conString); // Setup our Postgres Client
    client.connect(); // connect to the client
    var query = client.query(new Query(book_query)); // Run our Query
    query.on("row", function(row, result) {
        result.addRow(row);
    });
    // Pass the result to the map page
    query.on("end", function(result) {
        var data = result.rows[0].row_to_json // Save the JSON as variable data
        res.render('map-book', {
            title: "Map book", // Give a title to our page
            jsonData: data // Pass data to the View
        });
    });
});