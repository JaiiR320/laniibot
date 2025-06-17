const { createClient } = require("@supabase/supabase-js");
const { dbUrl, dbPublicKey } = require("../config.json");

const supabase = createClient(dbUrl, dbPublicKey);

module.exports = supabase;
