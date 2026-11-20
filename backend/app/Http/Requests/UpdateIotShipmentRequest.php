<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateIotShipmentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', 'string', Rule::in([
                'pending',
                'packed',
                'shipped',
                'in_transit',
                'out_for_delivery',
                'delivered',
                'cancelled',
            ])],
            'courier_name' => ['nullable', 'string', 'max:100'],
            'tracking_number' => ['nullable', 'string', 'max:150'],
            'tracking_url' => ['nullable', 'url:http,https', 'max:2048'],
            'dispatched_at' => ['nullable', 'date'],
            'estimated_delivery_date' => ['nullable', 'date'],
            'delivery_remarks' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
