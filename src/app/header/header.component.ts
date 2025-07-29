import { CommonModule } from '@angular/common';
import { Component,HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
@Component({
    selector: 'app-header',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule
    ],
    templateUrl: './header.component.html'
    
})
export class HeaderComponent implements OnInit {
  dropdownOpen = false;
  selectedItem: string | null = null;
  dataSubscription!: Subscription;

  constructor(private router: Router){}

  ngOnInit(): void {
  }
  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  selectOption(option: string, event: Event): void {
    event.stopPropagation(); // Prevent click from bubbling to wrapper
    this.selectedItem = option;
    this.dropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  handleOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const insideDropdown = target.closest('.custom-dropdown-wrapper');
    if (!insideDropdown) {
      this.dropdownOpen = false;
    }
  }
 
}
