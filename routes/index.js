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
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

router.get('/login', function(req, res, next) {

    res.render('login', { title: 'Login' });
});

router.post('/login-lg', function(req, res, next) {
    const us = req.body.us;
    const pa = req.body.pa;
    res.render('login', { title: 'Login' });
});

router.get('/signup', function(req, res, next) {
    res.render('signup', { title: 'Signup' });
});

const bodyParser = require("body-parser");
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
                    var createextension = `CREATE EXTENSION postgis SCHEMA public VERSION "3.1.0";`;
                    await client_us.query(new Query(createextension));
                }, 5000);
                // client.query(new Query(createextension));
            } else {
                console.log(result);
                console.log("Ten dang nhap da ton tai");
                res.redirect('/signup');
            }
        });
    }
    req.session.User = req.body.us;
    await res.redirect('/profile');
});

router.get('/profile', function(req, res, next) {
    res.render('import', { title: 'Import shp' });
});

var table_name;
var obj;
var type;
var shape_type;
var lat;
var lng;
var coord;

var store = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads')
    },
    filename: async function(req, file, cb) {
        cb(null, file.originalname);
        if (path.extname(file.originalname) == ".shp") {
            table_name = path.parse(file.originalname).name;
            await shapefile.open("uploads/" + file.originalname).then(source => source.read().then(function log(results) {
                if (results.done)
                    return;
                // console.log("toa do diem dau tien" + results.value.geometry.coordinates);
                obj = Object.keys(results.value.properties);
                type = Object.values(results.value.properties);
                console.log(obj);
                console.log(type);
                console.log(obj.length);
                // console.log(results.value.geometry.coordinates);
                shape_type = results.value.geometry.type;
                if (shape_type.toUpperCase() == "POINT") {
                    lng.push(results.value.geometry.coordinates[0]);
                    lat.push(results.value.geometry.coordinates[1]);
                }
                return source.read().then(log);
            })).catch(error => console.error(error.stack));
        }
    }
});
var upload = multer({ storage: store });

var import_shape = async function(req, res, next) {
    const example = req.file;
    var conString_user = "postgres://" + username + ":" + password + "@" + host + "/" + req.session.User;
    console.log(req.session.User);
    var client_us = new Client(conString_user);
    client_us.connect();
    var query_create_database = "CREATE TABLE " + table_name + "(";
    await shapefile.open("uploads/" + table_name + ".shp").then(source => source.read().then(async function log(results) {
        if (results.done)
            return;

        obj = Object.keys(results.value.properties);
        type = Object.values(results.value.properties);
        // console.log("object:" + obj);
        // console.log("type:" + type);

        shape_type = results.value.geometry.type;
        // console.log(table_name);

        var com = ",";
        for (i = 0; i < obj.length; i++) {
            if (typeof type[i] === "string")
                query_create_database += obj[i] + ' varchar ' + com;
            if (typeof type[i] === "number")
                query_create_database += obj[i] + ' float ' + com;
            if (typeof type[i] === "object")
                query_create_database += obj[i] + ' varchar ' + com;
        }
        query_create_database += "geom geometry(" + shape_type.toUpperCase() + ",4326));";
        // console.log("query:" + query_create_database);
        await client_us.query(query_create_database, async function(err, result) {
            if (err) {
                // return console.error('Error executing query 123', err.stack);
            }
        });

        return source.read().then(log);
    })).catch(error => console.error(error.stack));
    await shapefile.open("uploads/" + table_name + ".shp").then(source => source.read().then(async function log(results) {
        if (results.done)
            return;
        var com = ",";

        var query_insert_data = "insert into " + table_name.toLowerCase() + " values(";
        for (var i = 0; i < type.length; i++) {
            console.log("type of type: " + typeof type[i]);
            if (typeof type[i] === "string") {
                query_insert_data += await "'" + type[i] + "'" + com;
            } else if (typeof type[i] === "string" && type[i] === "") {
                query_insert_data += await "'null'" + com;
            } else if (typeof type[i] === "number" && type[i] === "") {
                query_insert_data += await 0 + com;
            } else if (typeof type[i] === "object") {
                query_insert_data += await type[i] + com;
            } else {
                query_insert_data += await type[i] + com;
            }

        }
        // await console.log(query_insert_data);
        if (shape_type.toUpperCase() == "POINT") {
            lng = await results.value.geometry.coordinates[0];
            lat = await results.value.geometry.coordinates[1];
            query_insert_data += await "ST_SetSRID(ST_MakePoint(" + lng + "," + lat + "),4326)";
        }
        var line_point = "";
        // await console.log(query_insert_data);
        if (shape_type.toUpperCase() == "LINESTRING" || shape_type.toUpperCase() == "MULTILINESTRING") {
            coord = results.value.geometry.coordinates;
            // console.log(coord.length);
            for (var j = 0; j < coord.length; j++) {
                if (j < coord.length - 1) {
                    line_point += await "ST_MakePoint(" + coord[j] + ")" + com;
                } else {
                    line_point += await "ST_MakePoint(" + coord[j] + ")"
                }
            }
            query_insert_data += await "ST_SetSRID(ST_MakeLine(ARRAY[" + line_point + "]),4326)"
        }
        // await console.log(query_insert_data);

        if (shape_type.toUpperCase() == "POLYGON") {
            coord = await results.value.geometry.coordinates[0];
            //console.log(coord);
            for (var j = 0; j < coord.length; j++) {
                if (j < coord.length - 1) {
                    line_point += await "ST_MakePoint(" + coord[j] + ")" + com;
                } else {
                    line_point += await "ST_MakePoint(" + coord[j] + ")"
                }
            }
            query_insert_data += await "ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[" + line_point + "])),4326)"
        }
        query_insert_data += await ");";
        // await console.log(query_insert_data);
        var query_alter_geom = "ALTER TABLE " + table_name + " ALTER COLUMN geom TYPE geometry (multipolygon, 4326) USING ST_Multi(geom);";
        // await client_us.query(query_alter_geom, async function(err, result) {
        //     if (err) {
        //         return console.error('Error executing query', err.stack);
        //     } else {

        //     }
        //     //res.redirect("../db/list_table");
        // });
        await client_us.query(query_insert_data, async function(err, result) {
            if (err) {
                // return console.error('Error executing query', err.stack);
            }
            console.log("insert value thanh cong");
            //res.redirect("../db/list_table");
        });

        // await console.log(query_insert_data);
        // await console.log(query_create_database);


        return source.read().then(log);
    })).catch(error => console.error(error.stack));
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
    await res.redirect('/signup');
};
router.post('/profile', upload.array("shp", 12), import_shape);

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