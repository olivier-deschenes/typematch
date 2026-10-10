export const sampleSource = {
  name: 'order.json',
  formatId: 'json',
  raw: JSON.stringify(
    {
      order: {
        id: 'SO-10482',
        createdAt: '2026-10-08T14:32:00Z',
        currency: 'CAD',
        total: 249.97,
        paid: true,
        customer: {
          id: 'C-2201',
          name: 'Juliette Martin',
          email: 'juliette.martin@example.com',
          phone: '+1 514 555 0142',
        },
        addresses: [
          {
            type: 'sender',
            company: 'Atelier Nord',
            street: '1200 Rue Sainte-Catherine O',
            city: 'Montréal',
            province: 'QC',
            postalCode: 'H3B 1K9',
            country: 'CA',
          },
          {
            type: 'receiver',
            company: null,
            street: '88 Queen St W',
            city: 'Toronto',
            province: 'ON',
            postalCode: 'M5H 2N2',
            country: 'CA',
          },
        ],
        items: [
          {
            sku: 'LMP-001',
            description: 'Desk lamp',
            quantity: 2,
            price: 79.99,
          },
          {
            sku: 'CBL-210',
            description: 'USB-C cable',
            quantity: 3,
            price: 29.99,
          },
        ],
        shipping: { method: 'express', weightKg: 3.4, insured: false },
        notes: ['Leave at reception', 'Fragile'],
      },
    },
    null,
    2,
  ),
}

export const sampleTarget = {
  name: 'shipment.xml',
  formatId: 'xml',
  raw: `<?xml version="1.0" encoding="UTF-8"?>
<Shipment id="SHP-77310" service="EXPRESS">
  <Reference>SO-10482</Reference>
  <ShipDate>2026-10-09</ShipDate>
  <Shipper>
    <CompanyName>Atelier Nord</CompanyName>
    <Address>
      <Street>1200 Rue Sainte-Catherine O</Street>
      <City>Montréal</City>
      <Region>QC</Region>
      <PostalCode>H3B 1K9</PostalCode>
      <CountryCode>CA</CountryCode>
    </Address>
  </Shipper>
  <Consignee>
    <ContactName>Juliette Martin</ContactName>
    <Email>juliette.martin@example.com</Email>
    <Phone>+1 514 555 0142</Phone>
    <Address>
      <Street>88 Queen St W</Street>
      <City>Toronto</City>
      <Region>ON</Region>
      <PostalCode>M5H 2N2</PostalCode>
      <CountryCode>CA</CountryCode>
    </Address>
  </Consignee>
  <Packages>
    <Package seq="1">
      <Weight unit="kg">3.4</Weight>
      <Contents>Desk lamp</Contents>
      <Quantity>2</Quantity>
    </Package>
    <Package seq="2">
      <Weight unit="kg">0.4</Weight>
      <Contents>USB-C cable</Contents>
      <Quantity>3</Quantity>
    </Package>
  </Packages>
  <DeclaredValue currency="CAD">249.97</DeclaredValue>
  <Insured>false</Insured>
  <Instructions>Leave at reception</Instructions>
</Shipment>
`,
}
