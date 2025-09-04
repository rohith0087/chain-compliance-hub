-- Add missing foreign key constraints to branch_supplier_connections table
ALTER TABLE public.branch_supplier_connections 
ADD CONSTRAINT fk_branch_supplier_connections_branch_id 
FOREIGN KEY (branch_id) REFERENCES public.company_branches(id) ON DELETE CASCADE;

ALTER TABLE public.branch_supplier_connections 
ADD CONSTRAINT fk_branch_supplier_connections_supplier_id 
FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;

ALTER TABLE public.branch_supplier_connections 
ADD CONSTRAINT fk_branch_supplier_connections_buyer_id 
FOREIGN KEY (buyer_id) REFERENCES public.buyers(id) ON DELETE CASCADE;