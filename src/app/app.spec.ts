import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { StoreService } from './services/store.service';

describe('App', () => {
  const originalConfirm = window.confirm;
  const storeServiceMock = {
    getSession: async () => null,
    onAuthStateChange: () => ({
      unsubscribe: () => undefined,
    }),
    subscribeToDataChanges: async () => ({
      unsubscribe: () => undefined,
    }),
  };

  beforeEach(async () => {
    window.confirm = () => true;

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: StoreService, useValue: storeServiceMock }],
    }).compileComponents();
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render auth title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Goldfinger Manager');
  });
});
