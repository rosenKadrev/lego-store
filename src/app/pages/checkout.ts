import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Courier, DeliveryType } from '../core/models';
import { Supabase } from '../core/supabase';
import { Icon } from '../shared/icon';
import { AuthStore } from '../stores/auth.store';
import { CartStore } from '../stores/cart.store';

const PHONE_PATTERN = /^(\+359|0)[\d\s-]{8,12}$/;

@Component({
  selector: 'app-checkout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, Icon],
  template: `
    <div class="container-page pt-8">
      <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Поръчка</h1>

      @if (!cart.items().length) {
        <div class="mt-10 flex flex-col items-center gap-4 rounded-3xl bg-zinc-50 py-20 text-center">
          <p class="text-lg font-semibold">Количката е празна</p>
          <a routerLink="/catalog" class="btn-primary">Разгледай продуктите</a>
        </div>
      } @else {
        @if (!auth.isLoggedIn()) {
          <p class="mt-4 text-sm text-zinc-600">
            Имате профил? <a routerLink="/login" [queryParams]="{ redirect: '/checkout' }" class="font-semibold text-brick-600 hover:underline">Влезте</a>,
            за да следите поръчките си. Може да поръчате и без регистрация.
          </p>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]" novalidate>
          <div class="space-y-8">
            <section class="card p-5 sm:p-7">
              <h2 class="flex items-center gap-3 text-lg font-bold">
                <span class="grid size-8 place-items-center rounded-full bg-ink-900 text-sm text-white">1</span> Данни за контакт
              </h2>
              <div class="mt-5 grid gap-4 sm:grid-cols-2">
                <div class="sm:col-span-2">
                  <label class="label" for="name">Име и фамилия</label>
                  <input id="name" class="input" formControlName="customerName" autocomplete="name" />
                  @if (showError('customerName')) { <p class="field-error">Въведете име и фамилия.</p> }
                </div>
                <div>
                  <label class="label" for="phone">Телефон</label>
                  <input id="phone" class="input" formControlName="phone" type="tel" autocomplete="tel" placeholder="0888 123 456" />
                  @if (showError('phone')) { <p class="field-error">Въведете валиден български номер.</p> }
                </div>
                <div>
                  <label class="label" for="email">Имейл</label>
                  <input id="email" class="input" formControlName="email" type="email" autocomplete="email" />
                  @if (showError('email')) { <p class="field-error">Въведете валиден имейл.</p> }
                </div>
              </div>
            </section>

            <section class="card p-5 sm:p-7">
              <h2 class="flex items-center gap-3 text-lg font-bold">
                <span class="grid size-8 place-items-center rounded-full bg-ink-900 text-sm text-white">2</span> Доставка
              </h2>

              <div class="mt-5 grid gap-3" [class]="deliveryTypes().length === 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2'">
                @for (d of deliveryTypes(); track d.value) {
                  <label
                    class="flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition"
                    [class]="deliveryType() === d.value ? 'border-brick-600 bg-brick-50' : 'border-zinc-200 hover:border-zinc-300'"
                  >
                    <input type="radio" formControlName="deliveryType" [value]="d.value" class="mt-1 accent-brick-600" />
                    <span class="flex-1">
                      <span class="block font-semibold">{{ d.label }}</span>
                      <span class="text-sm text-zinc-500">
                        {{ d.value === 'pickup' ? 'Безплатно' : 'Цена по уточнение' }}
                      </span>
                    </span>
                  </label>
                }
              </div>

              @if (deliveryType() === 'pickup') {
                <div class="mt-5 flex gap-3 rounded-2xl bg-zinc-50 p-4 text-sm">
                  <app-icon name="box" class="mt-0.5 text-brick-600" />
                  <div>
                    <p class="font-semibold">Къде да вземете поръчката</p>
                    @if (cart.settings()?.pickup_address; as address) {
                      <p class="mt-1 text-zinc-700">{{ address }}</p>
                    } @else {
                      <p class="mt-1 text-zinc-700">Ще ви съобщим адреса, когато потвърждаваме поръчката по телефона.</p>
                    }
                    @if (cart.settings()?.pickup_hours; as hours) {
                      <p class="mt-1 text-zinc-500">{{ hours }}</p>
                    }
                    <p class="mt-2 text-zinc-500">Ще ви се обадим, когато поръчката е готова за взимане.</p>
                  </div>
                </div>
              } @else {
                <div class="mt-5 flex gap-3 rounded-2xl bg-stud-300/30 p-4 text-sm">
                  <app-icon name="truck" class="mt-0.5 shrink-0 text-ink-900" />
                  <p>
                    <b>Цената на доставката се уточнява от служител.</b>
                    Ще ви се обадим, за да потвърдим поръчката и да ви кажем точната цена според куриера и размера на пратката.
                  </p>
                </div>
                <p class="label mt-5">Куриер</p>
                <div class="grid grid-cols-2 gap-3">
                  @for (c of couriers; track c.value) {
                    <label
                      class="flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition"
                      [class]="form.value.courier === c.value ? 'border-brick-600 bg-brick-50' : 'border-zinc-200 hover:border-zinc-300'"
                    >
                      <input type="radio" formControlName="courier" [value]="c.value" class="accent-brick-600" />
                      <span class="font-semibold">{{ c.label }}</span>
                    </label>
                  }
                </div>
              }

              <div class="mt-5 grid gap-4 sm:grid-cols-2">
                @if (deliveryType() !== 'pickup') {
                  <div [class.sm:col-span-2]="deliveryType() === 'office'">
                    <label class="label" for="city">Град</label>
                    <input id="city" class="input" formControlName="city" autocomplete="address-level2" />
                    @if (showError('city')) { <p class="field-error">Въведете град.</p> }
                  </div>
                }
                @if (deliveryType() === 'office') {
                  <div class="sm:col-span-2">
                    <label class="label" for="office">Офис на {{ form.value.courier === 'econt' ? 'Еконт' : 'Спиди' }}</label>
                    <input id="office" class="input" formControlName="officeCode" placeholder="Име или адрес на офиса" />
                    @if (showError('officeCode')) { <p class="field-error">Посочете офис.</p> }
                  </div>
                } @else if (deliveryType() === 'address') {
                  <div>
                    <label class="label" for="address">Адрес</label>
                    <input id="address" class="input" formControlName="address" autocomplete="street-address" placeholder="ул., №, бл., вх., ет., ап." />
                    @if (showError('address')) { <p class="field-error">Въведете адрес.</p> }
                  </div>
                }
                <div class="sm:col-span-2">
                  <label class="label" for="note">Бележка към поръчката <span class="font-normal text-zinc-400">(по избор)</span></label>
                  <textarea id="note" class="input min-h-20" formControlName="note"></textarea>
                </div>
              </div>
            </section>

            <section class="card p-5 sm:p-7">
              <h2 class="flex items-center gap-3 text-lg font-bold">
                <span class="grid size-8 place-items-center rounded-full bg-ink-900 text-sm text-white">3</span> Плащане
              </h2>
              <label class="mt-5 flex items-center gap-3 rounded-2xl border-2 border-brick-600 bg-brick-50 p-4">
                <app-icon name="cash" class="text-brick-600" />
                <span>
                  <span class="block font-semibold">{{ deliveryType() === 'pickup' ? 'В брой при взимане' : 'Наложен платеж' }}</span>
                  <span class="text-sm text-zinc-600">
                    @if (deliveryType() === 'pickup') {
                      Плащате в брой, когато вземете поръчката. Можете да я прегледате на място.
                    } @else {
                      Плащате на куриера при получаване. Можете да прегледате пратката преди плащане.
                    }
                  </span>
                </span>
              </label>
            </section>
          </div>

          <aside class="h-fit space-y-4 rounded-3xl bg-zinc-50 p-6 lg:sticky lg:top-32">
            <h2 class="text-lg font-bold">Вашата поръчка</h2>
            <ul class="space-y-3">
              @for (item of cart.items(); track item.listingId) {
                <li class="flex items-center gap-3 text-sm">
                  <span class="relative size-14 shrink-0 rounded-xl bg-white">
                    @if (item.imageUrl) {
                      <img [src]="item.imageUrl" alt="" class="size-full object-contain p-1" />
                    }
                    <span class="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-ink-900 text-[11px] font-bold text-white">{{ item.quantity }}</span>
                  </span>
                  <span class="line-clamp-2 flex-1">{{ item.name }}</span>
                  <b>{{ item.price * item.quantity | currency }}</b>
                </li>
              }
            </ul>
            <div class="space-y-2 border-t border-zinc-200 pt-4 text-sm">
              <div class="flex justify-between"><span>Продукти</span><span>{{ cart.subtotal() | currency }}</span></div>
              <div class="flex justify-between">
                <span>Доставка</span>
                <span>@if (deliveryType() === 'pickup') { Лично взимане } @else { <span class="text-zinc-500">уточнява се</span> }</span>
              </div>
              <div class="flex justify-between pt-2 text-lg font-bold"><span>{{ deliveryType() === 'pickup' ? 'Общо' : 'Общо без доставка' }}</span><span>{{ total() | currency }}</span></div>
            </div>

            <label class="flex items-start gap-2 text-sm">
              <input type="checkbox" formControlName="acceptTerms" class="mt-0.5 accent-brick-600" />
              <span>Съгласен съм с <a routerLink="/info/terms" class="underline">общите условия</a> и <a routerLink="/info/privacy" class="underline">политиката за поверителност</a>.</span>
            </label>
            @if (showError('acceptTerms')) { <p class="field-error">Необходимо е съгласие.</p> }

            @for (note of notes(); track note) {
              <p class="rounded-xl bg-stud-300/40 p-3 text-sm">{{ note }}</p>
            }
            @if (error()) {
              <p class="rounded-xl bg-brick-50 p-3 text-sm text-brick-800">{{ error() }}</p>
            }

            <button type="submit" class="btn-primary w-full py-3.5 text-base" [disabled]="submitting()">
              {{ submitting() ? 'Изпращане…' : 'Завърши поръчката' }}
            </button>
          </aside>
        </form>
      }
    </div>
  `,
})
export class Checkout {
  protected readonly cart = inject(CartStore);
  protected readonly auth = inject(AuthStore);
  private readonly supabase = inject(Supabase);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly couriers: { value: Courier; label: string }[] = [
    { value: 'econt', label: 'Еконт' },
    { value: 'speedy', label: 'Спиди' },
  ];
  protected readonly deliveryTypes = computed<{ value: DeliveryType; label: string }[]>(() => [
    { value: 'office', label: 'До офис' },
    { value: 'address', label: 'До адрес' },
    ...(this.cart.settings()?.pickup_enabled ? [{ value: 'pickup' as const, label: 'Лично взимане' }] : []),
  ]);

  protected readonly form = this.fb.group({
    customerName: ['', [Validators.required, Validators.minLength(3)]],
    phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    email: ['', [Validators.required, Validators.email]],
    courier: this.fb.control<Courier>('econt'),
    deliveryType: this.fb.control<DeliveryType>('office'),
    city: ['', Validators.required],
    officeCode: ['', Validators.required],
    address: [''],
    note: [''],
    acceptTerms: [false, Validators.requiredTrue],
  });

  protected readonly deliveryType = toSignal(this.form.controls.deliveryType.valueChanges, { initialValue: 'office' as DeliveryType });
  protected readonly shipping = computed(() => this.cart.shippingFor(this.deliveryType()));
  protected readonly total = computed(() => this.cart.subtotal() + (this.shipping() ?? 0));
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notes = signal<string[]>([]);

  constructor() {
    // Only the visible delivery fields are required (pickup needs none)
    this.form.controls.deliveryType.valueChanges.subscribe((type) => {
      const { officeCode, address, city } = this.form.controls;
      officeCode.setValidators(type === 'office' ? Validators.required : null);
      address.setValidators(type === 'address' ? Validators.required : null);
      city.setValidators(type === 'pickup' ? null : Validators.required);
      officeCode.updateValueAndValidity();
      address.updateValueAndValidity();
      city.updateValueAndValidity();
    });

    // Prefill from the profile once it's loaded, without overwriting what the user typed
    effect(() => {
      const profile = this.auth.profile();
      const email = this.auth.user()?.email;
      const c = this.form.controls;
      if (profile?.full_name && !c.customerName.value) c.customerName.setValue(profile.full_name);
      if (profile?.phone && !c.phone.value) c.phone.setValue(profile.phone);
      if (email && !c.email.value) c.email.setValue(email);
    });
  }

  protected showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    try {
      const notes = await this.cart.refresh();
      this.notes.set(notes);
      if (notes.length || !this.cart.items().length) return; // let the buyer review the changes

      const v = this.form.getRawValue();
      const { data, error } = await this.supabase.client.rpc('place_order', {
        p_customer_name: v.customerName.trim(),
        p_phone: v.phone.trim(),
        p_email: v.email.trim(),
        p_courier: v.courier,
        p_delivery_type: v.deliveryType,
        p_city: v.deliveryType === 'pickup' ? undefined : v.city.trim(),
        p_office_code: v.deliveryType === 'office' ? v.officeCode.trim() : undefined,
        p_address: v.deliveryType === 'address' ? v.address.trim() : undefined,
        p_note: v.note.trim() || undefined,
        p_items: this.cart.items().map((i) => ({ listing_id: i.listingId, quantity: i.quantity })),
      });

      if (error) {
        if (error.message.startsWith('OUT_OF_STOCK')) {
          this.notes.set(await this.cart.refresh());
          this.error.set('Някой продукт току-що беше изчерпан. Прегледайте количката и опитайте отново.');
        } else {
          this.error.set('Поръчката не можа да бъде изпратена. Опитайте отново след малко.');
        }
        return;
      }

      const order = data[0];
      this.cart.clear();
      void this.router.navigate(['/order', order.order_number], {
        state: { total: order.total, email: v.email, phone: v.phone, pickup: v.deliveryType === 'pickup' },
      });
    } finally {
      this.submitting.set(false);
    }
  }
}
