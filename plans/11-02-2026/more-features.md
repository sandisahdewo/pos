Master Categories
  - id, tenant_id, name, description (optional)
  - each tenant can have different categories
  - each tenant can have many categories
  - each category can have many products
  - each category can have many units
  - each category can have many variants
Master Units
  - save the unit name and description
  - each tenant can have different units
  - each tenant can have many units
Master Variants & Variant Values
  - save the variant name and description
  - each tenant can have different variants
  - each tenant can have many variants
  - the example variant & value is
    - color
      - blue
      - red
      - green
    - size
      - S
      - M
      - L
    - material
      - cotton
      - silk
      - wool
Unit conversion
  - save the conversion rate between units
  - save the conversion formula between units
  - for example: 1 liter = 1000 milliliters, 1 kilogram = 1000 grams, 1 meter = 100 centimeters, 1 kilometer = 1000 meters
  - unit conversion will be implemented on the product purchase and sell, usually user buy the product in higher unit and sell in lower unit, but the system will automatically convert the stock and unit based on the conversion rate and formula
Master Products
  - id, tenant_id, category_id, name, description (optional)
  - product only have one category
  - product have toggle have variant or not
    - if not have variant save product as variant one, to simplify the database and system, but show the simple input form
    - if have variant save product as variant many, to simplify the database and system, but show the complex input form
  - product can have many images
  - product have sell methods (FIFO or LIFO)
    - FIFO mean First In First Out
      - FIFO is calculated by selling the oldest product first
    - LIFO mean Last In First Out
      - LIFO is calculated by selling the newest product first
  - product have status (active, inactive)
  - product have tax rate (optional)
  - product have discount rate (optional)
  - product have min and max quantity (optional) (will add the auto order feature later based on the minimum quantity) (will add the recommendation order quantity based on the maximum quantity or more advanced algorithm later)
  - product have setting price by markup percentage/amount or fixed price (if choose this give the recommendation price based on the calculation of the unit conversion and purchase price)
  - product can have default prices based on the setting price, but price can be overriden by the variant price
  - product can have many variants
    - can select many variant combinations, example: color: Blue, size: M, material: Cotton or color: Red, size: L
    - those combination is considered as a single variant
    - variant can have many images
    - variant can select the unit based on the product's category and unit
      - for example if the product category is milk, the unit can be liter or milliliter,
        then the variant can have a different unit based on the product's unit
      - stock will be calculated based on the purchase order and the unit
    - variant have barcode/gtin
    - variant have SKU
    - each variant have wholesale price
      - wholesale price have rules based on the quantity purchased
      - maybe like if the quantity purchased is less than 10, the price is $10, if the quantity purchased is more than 10, the price is $9, if the quantity purchased is more than 100, the price is $8
      - but wholesale price price also consider the product price settings (fixed or markup by percentage or amount)
    - each variant have retail price
    - maybe to handle the wholesale and retail price, maybe use single database structure to handle both wholesale and retail prices
    - each variant have different prices to override the product price and depends on the product price configuration (fixed or markup by percentage or amount)
    - each variant will have different stock
      - maybe calculate the stock based on purchase order, but give me the recommendation what's the best way to calculate or manage or save the stock

Master Warehouse
  - each tenant can have multiple warehouses
  - save the simple warehouse information

Master Supplier
  - each tenant can have multiple suppliers
  - save the simple supplier information

Purchase Order
  - each purchase order can select the warehouse (for delivery purpose)
  - each purchase order can select the supplier (for payment purpose)
  - each purchase order can have multiple items
  - each item can have multiple variants
  - each purchase order can input the quantity, unit
  - in the future will add feature to auto purchase order based on the stock level

Purchase Order Delivery
  - after purchase order is created, and the supplier sends the products, the purchase order will be marked as delivered
  - after purchase order delivery is marked, the warehouse guy will check the delivered items and update the stock based on the delivered items detail
  - ordered and delivered product can be different quantities, units and price. it's pretty common in real life, so we need to handle it properly, sometimes the supplier doesn't have the exact quantity or unit as ordered.
  - show the purchased order detail, what products, variants, quantity and price we ordered, if the quantity or price is different, add the field to fill the delivered quantity & price, this will update the product stock and price, if the quantity & price is equal, just mark it as ok
