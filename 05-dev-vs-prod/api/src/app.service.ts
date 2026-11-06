import { Injectable } from '@nestjs/common';
import slugify from 'slugify';

@Injectable()
export class AppService {
  getHello(): string {
    // teammate's change: return the greeting as a URL-friendly slug
    return slugify('Hello Worldad1d!', { lower: true });
  }
}
