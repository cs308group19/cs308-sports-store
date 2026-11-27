-- Turns the 12 demo products into real brand products. The catalogue seed only adds missing
-- SKUs, so the rows that already exist are renamed here.
--
-- Only name, model, description, price and discount_rate are set (the table's trigger also
-- moves updated_at). SKU, id, category, stock and cost stay as they are, and order items keep
-- the names saved at order time. Running the file again changes nothing.

update public.products
set (name, model, description, price, discount_rate) =
  ('Nike Women Grey Air Max 2011 Sports Shoes', 'NK-AM11-GRY', 'Women''s running shoe in grey with a visible Air Max cushioning unit and a contrasting coral outsole.', 119.00, 20.00)
where sku = 'RLY-RUN-001'
  and (name, model, description, price, discount_rate) is distinct from
  ('Nike Women Grey Air Max 2011 Sports Shoes', 'NK-AM11-GRY', 'Women''s running shoe in grey with a visible Air Max cushioning unit and a contrasting coral outsole.', 119.00, 20.00);

update public.products
set (name, model, description, price, discount_rate) =
  ('Puma Unisex White Cap', 'PM-CAP-WHT', 'White unisex cap with a curved peak and the Puma cat logo on the front.', 15.00, 0.00)
where sku = 'RLY-RUN-002'
  and (name, model, description, price, discount_rate) is distinct from
  ('Puma Unisex White Cap', 'PM-CAP-WHT', 'White unisex cap with a curved peak and the Puma cat logo on the front.', 15.00, 0.00);

update public.products
set (name, model, description, price, discount_rate) =
  ('Adidas Men Grey Flint TR Low Shoes', 'AD-FLTR-GRY', 'Men''s low-cut trail shoe in grey with a lugged outsole for uneven ground.', 129.00, 0.00)
where sku = 'RLY-RUN-003'
  and (name, model, description, price, discount_rate) is distinct from
  ('Adidas Men Grey Flint TR Low Shoes', 'AD-FLTR-GRY', 'Men''s low-cut trail shoe in grey with a lugged outsole for uneven ground.', 129.00, 0.00);

update public.products
set (name, model, description, price, discount_rate) =
  ('Nike Women Dunk High Skinny Olive Casual Shoes', 'NK-DUNK-OLV', 'Women''s high-top Dunk in dark olive with light blue details and a basketball-style cupsole.', 109.00, 0.00)
where sku = 'RLY-BSK-001'
  and (name, model, description, price, discount_rate) is distinct from
  ('Nike Women Dunk High Skinny Olive Casual Shoes', 'NK-DUNK-OLV', 'Women''s high-top Dunk in dark olive with light blue details and a basketball-style cupsole.', 109.00, 0.00);

update public.products
set (name, model, description, price, discount_rate) =
  ('Spalding TF-150 Basketball', 'SP-TF150-ORG', 'Orange Spalding TF-150 basketball with a pebbled surface and black channels.', 29.00, 0.00)
where sku = 'RLY-BSK-002'
  and (name, model, description, price, discount_rate) is distinct from
  ('Spalding TF-150 Basketball', 'SP-TF150-ORG', 'Orange Spalding TF-150 basketball with a pebbled surface and black channels.', 29.00, 0.00);

update public.products
set (name, model, description, price, discount_rate) =
  ('Puma Liga Football', 'PM-LIGA-GLD', 'Panelled Puma Liga football in a gold finish with a black cat logo.', 25.00, 0.00)
where sku = 'RLY-FTB-001'
  and (name, model, description, price, discount_rate) is distinct from
  ('Puma Liga Football', 'PM-LIGA-GLD', 'Panelled Puma Liga football in a gold finish with a black cat logo.', 25.00, 0.00);

update public.products
set (name, model, description, price, discount_rate) =
  ('Adidas F50 Orange Football Boots', 'AD-F50-ORG', 'Lightweight F50 football boots in orange with black stripes and moulded studs.', 85.00, 15.00)
where sku = 'RLY-FTB-002'
  and (name, model, description, price, discount_rate) is distinct from
  ('Adidas F50 Orange Football Boots', 'AD-F50-ORG', 'Lightweight F50 football boots in orange with black stripes and moulded studs.', 85.00, 15.00);

update public.products
set (name, model, description, price, discount_rate) =
  ('Roll-Up Exercise Mats, Set of 2', 'GY-MAT-SET2', 'Two roll-up exercise mats, red and dark green, with a striped strap, for yoga, stretching and floor work.', 28.00, 30.00)
where sku = 'RLY-GYM-001'
  and (name, model, description, price, discount_rate) is distinct from
  ('Roll-Up Exercise Mats, Set of 2', 'GY-MAT-SET2', 'Two roll-up exercise mats, red and dark green, with a striped strap, for yoga, stretching and floor work.', 28.00, 30.00);

update public.products
set (name, model, description, price, discount_rate) =
  ('Fingerless Training Gloves', 'GY-GLV-BLK', 'Fingerless lifting gloves in black with green details and an adjustable wrist strap.', 16.00, 0.00)
where sku = 'RLY-GYM-002'
  and (name, model, description, price, discount_rate) is distinct from
  ('Fingerless Training Gloves', 'GY-GLV-BLK', 'Fingerless lifting gloves in black with green details and an adjustable wrist strap.', 16.00, 0.00);

update public.products
set (name, model, description, price, discount_rate) =
  ('Converse Men Navy Chuck Taylor All Star Canvas Shoes', 'CV-CTAS-NVY', 'Men''s high-top Chuck Taylor All Star in navy canvas with a rubber toe cap.', 79.00, 0.00)
where sku = 'RLY-SNK-001'
  and (name, model, description, price, discount_rate) is distinct from
  ('Converse Men Navy Chuck Taylor All Star Canvas Shoes', 'CV-CTAS-NVY', 'Men''s high-top Chuck Taylor All Star in navy canvas with a rubber toe cap.', 79.00, 0.00);

update public.products
set (name, model, description, price, discount_rate) =
  ('Puma Unisex Fundamentals Red Water Bottle', 'PM-BTL-RED', 'Red squeeze bottle with a pull-up sports cap and the Puma cat logo.', 13.00, 0.00)
where sku = 'RLY-ACC-001'
  and (name, model, description, price, discount_rate) is distinct from
  ('Puma Unisex Fundamentals Red Water Bottle', 'PM-BTL-RED', 'Red squeeze bottle with a pull-up sports cap and the Puma cat logo.', 13.00, 0.00);

update public.products
set (name, model, description, price, discount_rate) =
  ('Adidas Unisex White Digital Watch', 'AD-DIGI-WHT', 'White unisex digital watch showing the time, day and date, with a matching strap.', 65.00, 0.00)
where sku = 'RLY-ACC-002'
  and (name, model, description, price, discount_rate) is distinct from
  ('Adidas Unisex White Digital Watch', 'AD-DIGI-WHT', 'White unisex digital watch showing the time, day and date, with a matching strap.', 65.00, 0.00);
