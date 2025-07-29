import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProductService, Product } from 'src/app/shared/services/product.service';

@Component({
  selector: 'app-tester-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tester-dashboard.component.html',
  styleUrls: ['./tester-dashboard.component.css'],
})
export class TesterDashboardComponent implements OnInit {
  products: Product[] = [];
  expandedProductId: string | null = null;
  expandedResultsProductId: string | null = null;
  generalExpanded: boolean = false;
  sidebarOpen = true;
  currentProductName: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['productName']) {
        this.currentProductName = params['productName'];
      }
    });

    this.productService.getProducts().subscribe((data) => {
      this.products = data;
    });
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleProduct(productId: string) {
    this.expandedProductId =
      this.expandedProductId === productId ? null : productId;
    this.expandedResultsProductId = null;
  }

  toggleResults(productId: string) {
    this.expandedResultsProductId =
      this.expandedResultsProductId === productId ? null : productId;
  }

  toggleGeneral() {
    this.generalExpanded = !this.generalExpanded;
  }

  onAutomationClick() {
    alert('Automation Results feature coming soon!');
  }
}
