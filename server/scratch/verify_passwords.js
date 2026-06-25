import db from "../src/config/db.js";
import bcrypt from "bcrypt";

async function run() {
  try {
    const users = await db('users').select('*');
    const commonPasswords = ["Test@1234", "Password123!", "User@1234", "password", "12345678", "devendra"];

    for (const u of users) {
      console.log(`\nUser: ${u.email} (${u.role})`);
      let found = false;
      for (const p of commonPasswords) {
        const matches = await bcrypt.compare(p, u.password);
        if (matches) {
          console.log(`  -> Password is: "${p}"`);
          found = true;
          break;
        }
      }
      if (!found) {
        console.log(`  -> Password hash: ${u.password.substring(0, 15)}... (No match among common passwords)`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await db.destroy();
  }
}

run();
