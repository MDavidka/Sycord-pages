import Image from "next/image";

const products = [
  {
    id: 1,
    name: "Classic Tee",
    price: "$29.99",
    image: "https://via.placeholder.com/640x480.png?text=T-Shirt",
  },
  {
    id: 2,
    name: "Slim-Fit Jeans",
    price: "$89.99",
    image: "https://via.placeholder.com/640x480.png?text=Jeans",
  },
  {
    id: 3,
    name: "Leather Sneakers",
    price: "$129.99",
    image: "https://via.placeholder.com/640x480.png?text=Shoes",
  },
  {
    id: 4,
    name: "Stylish Hat",
    price: "$24.99",
    image: "https://via.placeholder.com/640x480.png?text=Hat",
  },
];

export default function WebshopDemoPage() {
  return (
    <div className="bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Webshop</h1>
          <nav>
            <a href="#" className="text-muted-foreground hover:text-foreground">Home</a>
            <a href="#" className="ml-4 text-muted-foreground hover:text-foreground">Shop</a>
            <a href="#" className="ml-4 text-muted-foreground hover:text-foreground">About</a>
            <a href="#" className="ml-4 text-muted-foreground hover:text-foreground">Contact</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-4xl font-bold mb-4">Summer Collection</h2>
        <p className="text-muted-foreground mb-8">
          Check out our latest arrivals for the summer season.
        </p>
        <button className="bg-primary text-primary-foreground px-6 py-2 rounded-md">
          Shop Now
        </button>
      </section>

      {/* Product Grid */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {products.map((product) => (
            <div key={product.id} className="border border-border rounded-lg p-4">
              <Image
                src={product.image}
                alt={product.name}
                width={640}
                height={480}
                className="w-full h-auto rounded-md mb-4"
              />
              <h3 className="font-semibold">{product.name}</h3>
              <p className="text-muted-foreground">{product.price}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          &copy; 2024 My Webshop. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
