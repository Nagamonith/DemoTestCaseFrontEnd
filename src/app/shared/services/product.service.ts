import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';

export interface Product {
  id: string;
  name: string;
  description?: string;
  createdAt?: Date;
  editing?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private products = new BehaviorSubject<Product[]>([
    { id: '1', name: 'Qualis SPC', createdAt: new Date() },
    { id: '2', name: 'MSA', createdAt: new Date() },
    { id: '3', name: 'FMEA', createdAt: new Date() },
    { id: '4', name: 'Wizard', createdAt: new Date() },
    { id: '5', name: 'APQP', createdAt: new Date() }
  ]);

  getProducts(): Observable<Product[]> {
    return this.products.asObservable().pipe(
      delay(200)
    );
  }

  addProduct(name: string): Observable<Product> {
    if (!name?.trim()) {
      return throwError(() => new Error('Product name is required'));
    }

    const newProduct: Product = {
      id: Date.now().toString(),
      name: name.trim(),
      createdAt: new Date()
    };

    return of(newProduct).pipe(
      delay(200),
      tap(() => {
        this.products.next([...this.products.value, newProduct]);
      })
    );
  }

  updateProduct(product: Product): Observable<Product> {
    if (!product.id || !product.name?.trim()) {
      return throwError(() => new Error('Invalid product data'));
    }

    return of(product).pipe(
      delay(200),
      tap(() => {
        const updated = this.products.value.map(p => 
          p.id === product.id ? { ...product, name: product.name.trim() } : p
        );
        this.products.next(updated);
      })
    );
  }

  deleteProduct(id: string): Observable<boolean> {
    if (!id) {
      return throwError(() => new Error('Product ID is required'));
    }

    return of(true).pipe(
      delay(200),
      tap(() => {
        this.products.next(this.products.value.filter(p => p.id !== id));
      })
    );
  }
}