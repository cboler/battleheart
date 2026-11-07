import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { StatusComponent } from './status/status.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Battleheart • Tactical Party RPG',
  },
  {
    path: 'status',
    component: StatusComponent,
    title: 'Diagnostics • Battleheart',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
