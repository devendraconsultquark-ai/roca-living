import db from "../src/config/db.js";
import bcrypt from "bcrypt";

async function run() {
  try {
    const hashed = await bcrypt.hash("Test@1234", 10);
    
    // Reset devendra.consultquark@gmail.com (ID 10)
    await db("users").where({ id: 10 }).update({ password: hashed });
    console.log("Reset user 10 (devendra.consultquark@gmail.com) password to Test@1234");

    // Reset dev562211@gmail.com (ID 41)
    await db("users").where({ id: 41 }).update({ password: hashed });
    console.log("Reset user 41 (dev562211@gmail.com) password to Test@1234");

    // Reset tenant@gmail.com (ID 45)
    await db("users").where({ id: 45 }).update({ password: hashed });
    console.log("Reset user 45 (tenant@gmail.com) password to Test@1234");

  } catch (err) {
    console.error(err);
  } finally {
    await db.destroy();
  }
}

run();
