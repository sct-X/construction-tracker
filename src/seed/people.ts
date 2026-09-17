import type { Membership, Person, Side } from '../domain/types';
import { P, SIDE_ND, SIDE_NORM } from './helpers';

export const sides: Side[] = [
  { id: SIDE_ND, name: 'Norm and Dom' },
  { id: SIDE_NORM, name: 'Norm' },
];

export const people: Person[] = [
  {
    id: P.dominic,
    name: 'Dominic Barone',
    shortName: 'Dominic',
    phone: '0400 111 222',
    email: 'dominic@example.invalid',
    notificationsEnabled: true,
    installedToHomeScreen: true,
    testBuzzReceived: true,
  },
  {
    id: P.dom,
    name: 'Dom Barone',
    shortName: 'Dom',
    phone: '0400 333 444',
    email: 'dom@example.invalid',
    notificationsEnabled: true,
    installedToHomeScreen: true,
    testBuzzReceived: false,
  },
  {
    id: P.norm,
    name: 'Norm Halloran',
    shortName: 'Norm',
    phone: '0400 555 666',
    email: 'norm@example.invalid',
    notificationsEnabled: false,
    installedToHomeScreen: false,
    testBuzzReceived: false,
  },
  {
    id: P.raff,
    name: 'Raff Costa',
    shortName: 'Raff',
    phone: '0400 777 888',
    email: 'raff@example.invalid',
    notificationsEnabled: true,
    installedToHomeScreen: true,
    testBuzzReceived: true,
  },
  {
    id: P.alec,
    name: 'Alec Ferris',
    shortName: 'Alec',
    phone: '0400 999 000',
    notificationsEnabled: true,
    installedToHomeScreen: true,
    testBuzzReceived: false,
  },
];

export const memberships: Membership[] = [
  { id: 'm-dominic-nd', personId: P.dominic, sideId: SIDE_ND, role: 'admin' },
  { id: 'm-dom-nd', personId: P.dom, sideId: SIDE_ND, role: 'partner' },
  { id: 'm-norm-nd', personId: P.norm, sideId: SIDE_ND, role: 'partner' },
  { id: 'm-raff-nd', personId: P.raff, sideId: SIDE_ND, role: 'builder' },
  { id: 'm-alec-nd', personId: P.alec, sideId: SIDE_ND, role: 'site' },
  // Dominic and Norm belong to both sides, so they get the side switcher.
  { id: 'm-dominic-norm', personId: P.dominic, sideId: SIDE_NORM, role: 'admin' },
  { id: 'm-norm-norm', personId: P.norm, sideId: SIDE_NORM, role: 'partner' },
];
