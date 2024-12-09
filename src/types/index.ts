import { Context } from 'telegraf';

export interface MyContext extends Context {
  myProp?: string;
  // Add more custom properties here
} 


