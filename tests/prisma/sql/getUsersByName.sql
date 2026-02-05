-- @param {String} $1:namePattern - Pattern to match user names
SELECT id, email, name FROM "User" WHERE name LIKE ?
