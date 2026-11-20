<?php

namespace App\Mail;

use App\Models\IotShipment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ShipmentStatusUpdated extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(public IotShipment $shipment) {}

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $subjects = [
            'packed' => $this->shipment->delivery_method === 'pickup'
                ? 'Your IoT kit is ready for pickup'
                : 'Your IoT kit has been packed',
            'shipped' => 'Your IoT kit has been shipped',
            'out_for_delivery' => 'Your IoT kit is out for delivery',
            'delivered' => $this->shipment->delivery_method === 'pickup'
                ? 'Your IoT kit has been collected'
                : 'Your IoT kit has been delivered',
        ];

        return new Envelope(subject: $subjects[$this->shipment->status] ?? 'Shipment update');
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            markdown: 'mail.shipments.status-updated',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
