npm run refresh:codes

npm run import:games -- [url] [url] [url]

curl -X POST http://localhost:3000/api/admin/import \
     -H "Content-Type: application/json" \
     -H "x-admin-token: $ADMIN_TOKEN" \
     -d '{"sourceUrl":"https://www.robloxden.com/codes/some-game"}'

