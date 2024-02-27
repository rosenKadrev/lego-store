import { Component, inject } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';

import { SidenavComponent } from './navigation/sidenav/sidenav.component';
import { HeaderComponent } from './navigation/header/header.component';
import { AuthService } from './auth/auth.service';
import { FooterComponent } from './navigation/footer/footer.component';
import { LoaderComponent } from './loader/loader.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LoaderComponent, SidenavComponent, FooterComponent, HeaderComponent, MatSidenavModule, RouterModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private authService = inject(AuthService);


  ngOnInit() {
    this.authService.autoAuthUser();
  }
}
