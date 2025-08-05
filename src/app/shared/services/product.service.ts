import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { DUMMY_PRODUCTS } from 'src/app/shared/data/dummy-products';
import { Product } from 'src/app/shared/modles/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private products = new BehaviorSubject<Product[]>([...DUMMY_PRODUCTS]);

  /**
   * Returns observable stream of products with artificial delay.
   */
  getProducts(): Observable<Product[]> {
    return this.products.asObservable().pipe(delay(200));
  }

  /**
   * Returns the current list of products synchronously.
   */
  getProductsArray(): Product[] {
    return this.products.value;
  }

  /**
   * Returns a product matching the given ID.
   */
  getProductById(id: string): Product | undefined {
    return this.products.value.find(product => product.id === id);
  }

  /**
   * Add a new product.
   * Returns Observable to simulate HTTP response.
   */
addProduct(name: string): Observable<void> {
  const newProduct: Product = {
    id: Date.now().toString(),
    name: name,
    isActive: true, // ✅ Add this line
    editing: false
  };
  const current = this.products.value;
  this.products.next([...current, newProduct]);
  return of(undefined).pipe(delay(200)); // Simulate API delay
}

  /**
   * Update an existing product.
   * Returns Observable<boolean> to simulate HTTP response.
   */
  updateProduct(updatedProduct: Product): Observable<boolean> {
    return of(true).pipe(
      delay(200), // Simulate API delay
      tap(() => {
        const current = this.products.value;
        const index = current.findIndex(p => p.id === updatedProduct.id);
        if (index === -1) return;

        const updated = [...current];
        updated[index] = updatedProduct;
        this.products.next(updated);
      })
    );
  }

  /**
   * Delete a product by ID.
   * Returns Observable<boolean> to simulate HTTP response.
   */
  deleteProduct(id: string): Observable<boolean> {
    return of(true).pipe(
      delay(200), // Simulate API delay
      tap(() => {
        const current = this.products.value;
        const updated = current.filter(p => p.id !== id);
        this.products.next(updated);
      })
    );
  }

  /**
   * Helper method to add a product (synchronous version)
   * For internal use if needed
   */
  private addProductSync(product: Product): void {
    const current = this.products.value;
    this.products.next([...current, product]);
  }
}

export type { Product };
