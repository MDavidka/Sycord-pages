echo "--- isAllowedPreviewUrl check ---"
cat app/api/workspace/preview-frame/route.ts | grep -A 20 -B 5 "function isAllowedPreviewUrl"

echo "--- frameAncestorsForRequest ---"
cat app/api/workspace/preview-frame/route.ts | grep -A 20 -B 5 "frameAncestorsForRequest"

echo "--- read_file checks ---"
grep -rn "readFile" app/api/ lib/ glovix/lib
grep -rn "writeFile" app/api/ lib/ glovix/lib

echo "--- multi-tenant leak test ---"
grep -rn "db.collection" app/api/ | grep -v "where" | grep -v "userId" | grep -v "projectId" | grep -v "organizationId" | grep -v "\{ \}" | grep -v "\{_id" | grep -v "\{ _id"
