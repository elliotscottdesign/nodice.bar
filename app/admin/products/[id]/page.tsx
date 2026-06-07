import ProductConfigClient from "./ProductConfigClient";

export const metadata = { title: "Configure product — No Dice Admin" };

// Static export needs to pre-render this dynamic route. Seeded
// products are `pool` and `table`; any new product would need
// adding here AND seeding in the DB.
export function generateStaticParams() {
  return [{ id: "pool" }, { id: "table" }];
}

export default function ProductConfigPage({
  params,
}: {
  params: { id: string };
}) {
  return <ProductConfigClient productId={params.id} />;
}
