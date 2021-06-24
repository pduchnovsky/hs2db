DROP TABLE deals;

CREATE TABLE deals (
    qstart TIMESTAMP NOT NULL,
    dealstage VARCHAR ( 50 ) not null,
    amount NUMERIC not null,
    count NUMERIC not null
);

GRANT SELECT ON TABLE deals TO grafana;

SELECT
  qstart,
  dealstage,
  amount,
  count
FROM deals
ORDER BY qstart ASC
