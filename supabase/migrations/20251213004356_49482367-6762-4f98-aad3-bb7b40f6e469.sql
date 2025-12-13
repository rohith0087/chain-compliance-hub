-- Remove Logic Foods connection to allow re-testing approval flow
DELETE FROM buyer_supplier_connections 
WHERE id = '5f5cac50-fae0-4e3a-a023-9ed050aa4816';