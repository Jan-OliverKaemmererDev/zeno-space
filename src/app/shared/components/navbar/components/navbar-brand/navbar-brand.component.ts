import { Component, output } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Navbar brand logo component linking to the root path.
 */
@Component({
  selector: 'app-navbar-brand',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar-brand.component.html',
  styleUrl: './navbar-brand.component.scss',
})
export class NavbarBrandComponent {
  /** Emitted when clicking the brand logo to close any open menus. */
  readonly brandClick = output<void>();
}
