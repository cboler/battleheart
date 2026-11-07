import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { StatusComponent } from './status/status.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Home • Angular PWA Starter',
  },
  {
    path: 'status',
    component: StatusComponent,
    title: 'Status & Diagnostics • Angular PWA Starter',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
