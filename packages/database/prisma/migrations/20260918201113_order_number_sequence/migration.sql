-- Order numbers ke liye ek Postgres sequence.
--
-- Alternative "SELECT max(orderNumber) + 1" hota, jo concurrent checkouts par
-- do orders ko ek hi number de deta — aur woh sirf tab pata chalta jab do
-- customers ka receipt same #NB-XXXX dikhata.
--
-- Sequence transaction ke bahar increment hoti hai, isliye rollback par gaps
-- aa sakte hain. Order numbers gapless hone ki zaroorat nahi, sirf UNIQUE
-- hone chahiye.
CREATE SEQUENCE IF NOT EXISTS order_number_seq
  START WITH 4100
  INCREMENT BY 1;
