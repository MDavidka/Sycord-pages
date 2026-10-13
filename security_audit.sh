echo "--- Auth Bypass / IDOR ---"
grep -rn "findOneAndUpdate" app/api/ lib/ | head -n 20
grep -rn "updateOne" app/api/ lib/ | head -n 20
grep -rn "deleteOne" app/api/ lib/ | head -n 20
grep -rn "deleteMany" app/api/ lib/ | head -n 20

echo "--- SSRF ---"
grep -rn "fetch(" app/api/ lib/ | grep -v "api.linear.app" | head -n 20

echo "--- Injection ---"
grep -rn "eval(" app/api/ lib/
grep -rn "exec(" app/api/ lib/
grep -rn "spawn(" app/api/ lib/

echo "--- XSS ---"
grep -rn "dangerouslySetInnerHTML" app/ components/ glovix/ | head -n 20

echo "--- Secrets ---"
grep -rn "password" app/api/ lib/ | head -n 10
grep -rn "secret" app/api/ lib/ | head -n 10

echo "--- CSP / CORS ---"
grep -rn "Access-Control-Allow-Origin" app/api/ lib/ middleware.ts
grep -rn "Content-Security-Policy" app/api/ lib/ middleware.ts
