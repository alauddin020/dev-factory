/* =============================================================================
 * DevFactory · mock backend data
 * -----------------------------------------------------------------------------
 * This file is ONLY used while APP_CONFIG.useMock === true.
 * Delete it (or leave it unused) once the real API is wired up.
 * ===========================================================================*/
window.MOCK_DATA = (function () {
  /* ---- demo accounts ------------------------------------------------------ */
  const users = [
    { id: 'USR-01', name: 'Ayesha Rahman', email: 'planner@demo.com', password: 'demo1234', role: 'Merchandise Planner' },
    { id: 'USR-02', name: 'Tanvir Hossain', email: 'admin@demo.com',  password: 'demo1234', role: 'Operations Admin' }
  ];

  /* ---- factories the logged-in user can work with ------------------------- */
  const factories = [
    { id: 'FAC-1001', name: 'Delta Apparels Ltd.',   city: 'Dhaka',        country: 'Bangladesh', units: 4, capacity: 82000, contact: 'md.karim@delta-apparels.com',   status: 'Active' },
    { id: 'FAC-1002', name: 'Padma Textiles',        city: 'Narayanganj',  country: 'Bangladesh', units: 2, capacity: 45000, contact: 'ops@padmatextiles.com',         status: 'Active' },
    { id: 'FAC-1003', name: 'Meghna Knitwear',       city: 'Gazipur',      country: 'Bangladesh', units: 3, capacity: 61000, contact: 'merch@meghnaknit.com',          status: 'Active' },
    { id: 'FAC-1004', name: 'Karnaphuli Denim',      city: 'Chattogram',   country: 'Bangladesh', units: 2, capacity: 38000, contact: 'planning@karnaphulidenim.com',  status: 'Active' },
    { id: 'FAC-1005', name: 'Sundarban Sweaters',    city: 'Khulna',       country: 'Bangladesh', units: 1, capacity: 22000, contact: 'info@sundarbansweaters.com',    status: 'Watch'  },
    { id: 'FAC-1006', name: 'Jamuna Washing Plant',  city: 'Savar',        country: 'Bangladesh', units: 1, capacity: 15000, contact: 'wash@jamunaplant.com',          status: 'Active' }
  ];

  /* ---- purchase orders ----------------------------------------------------
   * factoryId drives the "fetch factory_id based on PO" step.
   * ------------------------------------------------------------------------*/
  const rawPos = [
    ['PO-2026-0001', 'FAC-1001', 'H&M',        'AW26-BASIC-TEE', 'Basic crew-neck tee, 180 GSM',      24000, 'pcs', 'In Production', 62, '2026-07-14', '2026-11-05', 4.82],
    ['PO-2026-0002', 'FAC-1001', 'Zara',       'SS26-POLO-01',   'Pique polo, tipped collar',         12500, 'pcs', 'Confirmed',     18, '2026-08-02', '2026-12-12', 5.10],
    ['PO-2026-0003', 'FAC-1001', 'Uniqlo',     'AW26-CARDI-07',  'Merino blend cardigan',              6800, 'pcs', 'Delayed',       35, '2026-06-28', '2026-10-24', 9.40],
    ['PO-2026-0004', 'FAC-1001', 'Primark',    'AW26-HOOD-02',   'Fleece pullover hoodie',            18000, 'pcs', 'In Production', 74, '2026-07-01', '2026-10-30', 7.25],
    ['PO-2026-0005', 'FAC-1001', 'C&A',        'SS26-LEGG-03',   'Cotton-stretch leggings',           30000, 'pcs', 'Completed',    100, '2026-05-11', '2026-09-18', 3.60],
    ['PO-2026-0006', 'FAC-1002', 'Mango',      'SS26-BLOU-11',   'Viscose printed blouse',             9500, 'pcs', 'In Production', 48, '2026-07-22', '2026-11-28', 6.15],
    ['PO-2026-0007', 'FAC-1002', 'Next',       'AW26-KNIT-04',   'Ribbed knit midi dress',             5200, 'pcs', 'Confirmed',     12, '2026-08-09', '2026-12-20', 11.30],
    ['PO-2026-0008', 'FAC-1002', 'Gap',        'AW26-SWEAT-09',  'Loopback cotton sweatshirt',         14000, 'pcs', 'On Hold',        6, '2026-07-30', '2026-12-02', 8.05],
    ['PO-2026-0009', 'FAC-1002', 'Tommy',      'SS26-SHIRT-06',  'Oxford shirt, long sleeve',           7600, 'pcs', 'Shipped',       96, '2026-06-05', '2026-10-08', 9.75],
    ['PO-2026-0010', 'FAC-1003', 'Decathlon',  'AW26-SPORT-01',  'Moisture-wicking training tee',      26000, 'pcs', 'In Production', 55, '2026-07-18', '2026-11-15', 4.40],
    ['PO-2026-0011', 'FAC-1003', 'Adidas',     'AW26-TRACK-05',  'Tricot track jacket',                8200, 'pcs', 'Confirmed',     22, '2026-08-14', '2026-12-18', 13.60],
    ['PO-2026-0012', 'FAC-1003', 'Puma',       'SS26-TEE-12',    'Graphic print tee',                  19500, 'pcs', 'Delayed',       41, '2026-06-21', '2026-10-20', 5.35],
    ['PO-2026-0013', 'FAC-1003', 'Lidl',       'AW26-SOCK-08',   'Terry sport socks, 3-pack',          40000, 'pair','Completed',     100, '2026-05-30', '2026-09-25', 1.85],
    ['PO-2026-0014', 'FAC-1004', 'Levi\'s',    'AW26-DENIM-01',  '501 straight-fit denim',            16000, 'pcs', 'In Production', 68, '2026-07-09', '2026-11-22', 14.20],
    ['PO-2026-0015', 'FAC-1004', 'Wrangler',   'AW26-JACK-02',   'Rigid denim trucker jacket',          6400, 'pcs', 'Confirmed',     15, '2026-08-06', '2026-12-08', 18.90],
    ['PO-2026-0016', 'FAC-1004', 'Diesel',     'SS26-SKIN-03',   'Slim-fit stretch jeans',             11000, 'pcs', 'In Production', 59, '2026-07-26', '2026-11-30', 16.75],
    ['PO-2026-0017', 'FAC-1004', 'Lee',        'AW26-SHORT-04',  'Denim cargo shorts',                  9000, 'pcs', 'Shipped',       93, '2026-06-12', '2026-10-14', 10.50],
    ['PO-2026-0018', 'FAC-1005', 'Benetton',   'AW26-SWEATER-1', 'Lambswool crew sweater',              4200, 'pcs', 'Delayed',       28, '2026-07-05', '2026-11-10', 21.40],
    ['PO-2026-0019', 'FAC-1005', 'Esprit',     'AW26-CARD-05',   'Chunky cable cardigan',               3600, 'pcs', 'Confirmed',     10, '2026-08-18', '2026-12-26', 24.10],
    ['PO-2026-0020', 'FAC-1005', 'COS',        'AW26-TURTLE-2',  'Fine-knit turtleneck',                5000, 'pcs', 'In Production', 44, '2026-07-15', '2026-11-18', 19.80],
    ['PO-2026-0021', 'FAC-1006', 'G-Star',     'AW26-WASH-01',   'Heavy wash treatment, bulk',          22000, 'pcs', 'In Production', 71, '2026-07-20', '2026-11-12', 2.35],
    ['PO-2026-0022', 'FAC-1006', 'Nudie',      'AW26-WASH-02',   'Eco wash + ozone finishing',          12000, 'pcs', 'Confirmed',     20, '2026-08-11', '2026-12-05', 2.90],
    ['PO-2026-0023', 'FAC-1006', 'Pepe',       'SS26-WASH-03',   'Enzyme wash, soft hand-feel',         17500, 'pcs', 'Completed',    100, '2026-05-24', '2026-09-30', 2.60],
    ['PO-2026-0024', 'FAC-1001', 'Bershka',    'SS26-TOP-13',    'Cropped rib top',                    21000, 'pcs', 'In Production', 52, '2026-07-28', '2026-11-26', 4.15]
  ];

  const pos = rawPos.map(function (r) {
    return {
      po: r[0], factoryId: r[1], buyer: r[2], style: r[3], item: r[4],
      qty: r[5], unit: r[6], status: r[7], progress: r[8],
      orderDate: r[9], shipDate: r[10], unitPrice: r[11],
      value: Math.round(r[5] * r[11]),
      factory_id: r[1]   // the field the real API would return on PO lookup
    };
  });

  return { users: users, factories: factories, pos: pos };
})();
